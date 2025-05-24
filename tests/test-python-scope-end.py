# Test file for Python scope resolution

# @guard:hu:w
# Human can write base configuration

# @guard:ai:w
# AI can optimize this configuration class
class Config:
    def __init__(self):
        self.app_name = 'API Key Manager'
        self.version = '2.0.0'
        self.environment = os.getenv('ENV', 'development')

# @guard:ai:n
# Production API keys - AI must not access
PRODUCTION_KEYS = {
    'stripe': 'sk_live_4eC39HqLyjWDarjtT1zdp7dc',
    'openai': 'sk-proj-abc123def456ghi789',
    'aws_access': 'AKIAIOSFODNN7EXAMPLE',
    'aws_secret': 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY'
}