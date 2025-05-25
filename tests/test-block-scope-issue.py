# Test file to diagnose block scope issue
# The second @guard:human:r.block should color the dictionary block as read-only

def create_config():
    """Create configuration with two blocks."""
    
    # @guard:human:r.block
    settings = {
        "api_url": "https://api.example.com",
        "timeout": 30,
        "retries": 3
    }
    
    # @guard:human:r.block
    credentials = {
        "username": "admin",
        "password": "secret",
        "api_key": "12345"
    }
    
    return settings, credentials

# Expected behavior:
# Lines 7-12: Human read-only (first block)
# Lines 14-19: Human read-only (second block)
# But currently second block shows as human writable