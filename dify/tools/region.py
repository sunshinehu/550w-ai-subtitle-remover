"""Account region belongs to a connection, never to the interface language."""
REGION = "global"
API_KEY_URL = "https://eraser.550wai.com/api/"
VERSION = "3.2.0"
ALLOWED_REGIONS = ("cn", "global")


def account_region(credentials, *, required=False):
    region = credentials.get("region", None if required else REGION)
    if not isinstance(region, str) or region not in ALLOWED_REGIONS:
        raise ValueError("Choose the account region: cn or global; reconnect if it is missing")
    return region


def api_key_url(credentials):
    return ("https://qzm.550wai.cn/api-keys" if account_region(credentials) == "cn"
            else "https://eraser.550wai.com/api/")
