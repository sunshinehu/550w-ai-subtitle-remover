"""Connection isolation and migration compatibility for the consolidated provider."""
import base64
import hashlib
import json
import pathlib
import secrets
import sys
import time
import unittest
from concurrent.futures import ThreadPoolExecutor
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from urllib.parse import parse_qs, urlparse

import requests
import yaml
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from tools import oauth
from tools.api import call_api, call_upload
from tools.region import account_region, api_key_url
from dify_plugin.entities.oauth import OAuthSchema
from dify_plugin.entities.provider_config import ProviderConfig

SETTINGS = {"oauth_state_secret": "test-only-" + "a" * 40}
CALLBACK = "https://dify.example/console/api/oauth/plugin/550w/tool/callback"
TOKENS = {"access_token": "fixture-access", "refresh_token": "fixture-refresh", "expires_in": 900}


class RegionTests(unittest.TestCase):
    def test_schema_accepts_both_region_selectors_and_legacy_global_default(self):
        provider = yaml.safe_load((ROOT / 'provider/ai-subtitle-remover.yaml').read_text())
        key = ProviderConfig(name='region', **provider['credentials_for_provider']['region'])
        oauth_schema = OAuthSchema.model_validate(provider['oauth_schema'])
        for config in [key, next(c for c in oauth_schema.client_schema if c.name == 'region')]:
            self.assertEqual(config.default, 'global')
            self.assertEqual({o.value for o in config.options}, {'cn', 'global'})
        self.assertEqual(account_region({}), 'global')
        self.assertIn('qzm.550wai.cn/api-keys', api_key_url({'region': 'cn'}))
        self.assertIn('eraser.550wai.com/api/', api_key_url({}))

    def test_invalid_region_rejected_before_network_in_both_auth_modes(self):
        for region in ('', 'auto', 'CN', None, True, [], 'https://evil.example'):
            for credentials in ({'apiKey': 'fixture', 'userNo': 'fixture'}, {'access_token': 'fixture'}):
                with self.subTest(region=region), patch('tools.api.requests.post') as post:
                    with self.assertRaises(ValueError):
                        call_api({**credentials, 'region': region}, '/open/queryCredits', {})
                    post.assert_not_called()
        with self.assertRaises(ValueError):
            call_api({'access_token': 'fixture'}, '/open/queryCredits', {})

    def test_callback_uses_authenticated_state_region_even_if_admin_changes_selection(self):
        for region, changed in [('cn', 'global'), ('global', 'cn')]:
            with patch('tools.oauth._post', return_value={'client_id': 'public-client'}):
                params = parse_qs(urlparse(oauth.authorization_url(CALLBACK, {**SETTINGS, 'region': region})).query)
            self.assertEqual(params['resource'], ['https://www.550wai.cn/media-api/' + region])
            with patch('tools.oauth._post', return_value=TOKENS) as post:
                credentials, _ = oauth.exchange(CALLBACK, {**SETTINGS, 'region': changed},
                    SimpleNamespace(args={'state': params['state'][0], 'code': 'fixture'}))
            self.assertEqual(credentials['region'], region)
            self.assertEqual(post.call_args.args[1]['resource'], params['resource'][0])

    def test_legacy_global_inflight_state_survives_upgrade(self):
        nonce = secrets.token_bytes(12)
        h = base64.urlsafe_b64encode(hashlib.sha256(CALLBACK.encode()).digest()).decode().rstrip('=')
        payload = json.dumps({'t': int(time.time()), 'v': 'fixture-verifier', 'c': 'public-client', 'h': h}).encode()
        state = base64.urlsafe_b64encode(nonce + AESGCM(oauth._key(SETTINGS)).encrypt(nonce, payload, oauth.LEGACY_AAD)).decode().rstrip('=')
        with patch('tools.oauth._post', return_value=TOKENS):
            credentials, _ = oauth.exchange(CALLBACK, {**SETTINGS, 'region': 'cn'},
                SimpleNamespace(args={'state': state, 'code': 'fixture'}))
        self.assertEqual(credentials['region'], 'global')

    def test_forged_region_in_state_is_rejected_without_token_request(self):
        with patch('tools.oauth._post', return_value={'client_id': 'public-client'}):
            params = parse_qs(urlparse(oauth.authorization_url(CALLBACK, {**SETTINGS, 'region': 'cn'})).query)
        raw = bytearray(base64.urlsafe_b64decode(params['state'][0] + '=' * (-len(params['state'][0]) % 4)))
        raw[-1] ^= 1
        state = base64.urlsafe_b64encode(raw).decode()
        with patch('tools.oauth._post') as post, self.assertRaises(ValueError):
            oauth.exchange(CALLBACK, SETTINGS, SimpleNamespace(args={'state': state, 'code': 'fixture'}))
        post.assert_not_called()

    def test_cn_refresh_keeps_connection_region_and_rejects_global_resource_response(self):
        creds = {'region': 'cn', 'refresh_token': 'fixture', 'client_id': 'public-client'}
        with patch('tools.oauth._post', return_value=TOKENS) as post:
            result, _ = oauth.refresh(creds)
        self.assertEqual(result['region'], 'cn')
        self.assertEqual(post.call_args.args[1]['resource'], 'https://www.550wai.cn/media-api/cn')
        with patch('tools.oauth._post', return_value={**TOKENS, 'resource': oauth.RESOURCE}), self.assertRaises(ValueError):
            oauth.refresh(creds)

    def test_parallel_connections_do_not_share_mutable_region(self):
        def response(method, url, **kwargs):
            return {'code': 200, 'url': url, 'region': kwargs['region']}
        regions = ['cn', 'global'] * 20
        with patch('tools.api.http_json', side_effect=response):
            with ThreadPoolExecutor(max_workers=8) as pool:
                results = list(pool.map(lambda r: call_api({'access_token': 'fixture', 'region': r}, '/open/queryCredits', {}), regions))
        for region, result in zip(regions, results):
            self.assertEqual(result['region'], region)
            self.assertIn('/' + region + '/v1/account', result['url'])

    def test_cn_unknown_submission_and_upload_retain_region_and_original_operation(self):
        credentials = {'access_token': 'fixture', 'region': 'cn'}
        with patch('tools.api.requests.post', side_effect=requests.Timeout('fixture')) as post:
            result = call_api(credentials, '/open/removeVideoWatermark', {'videoUrl': 'https://example.com/share', 'operationId': 'original-id'})
        self.assertEqual((result['region'], result['operationId']), ('cn', 'original-id'))
        self.assertFalse(result['automaticRetryAllowed'])
        post.assert_called_once()
        with patch('tools.api.requests.post', side_effect=requests.Timeout('fixture')) as post:
            result = call_upload(credentials, '/open/removeImageWatermark', SimpleNamespace(filename='a.png', size=1, blob=b'x'), {'operationId': 'original-id'})
        self.assertEqual((result['region'], result['operationId']), ('cn', 'original-id'))
        self.assertIn('/cn/v1/media', post.call_args.args[0])
        self.assertTrue(post.call_args.kwargs['data'].fields['file'][1].closed)

    def test_api_key_legacy_and_cn_keep_fixed_backend_and_do_not_transmit_region_as_secret(self):
        for region in (None, 'cn', 'global'):
            credentials = {'userNo': 'fixture-user', 'apiKey': 'fixture-key'}
            if region is not None:
                credentials['region'] = region
            response = MagicMock()
            response.__enter__.return_value = response
            response.status_code = 200
            response.headers = {'Content-Type': 'application/json'}
            response.iter_content.return_value = [b'{"code":200}']
            with patch('tools.api.requests.post', return_value=response) as post:
                call_api(credentials, '/open/queryCredits', {})
            self.assertEqual(post.call_args.args[0], 'https://www.550wai.cn/open/queryCredits')
            self.assertEqual(set(post.call_args.kwargs['data']), {'userNo', 'apiKey'})
