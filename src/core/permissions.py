DEFAULT_PERMISSIONS = [
    {
        'key': 'campaign.read',
        'name': 'Read campaigns',
        'description': 'Allows viewing campaigns.',
    },
    {
        'key': 'campaign.manage',
        'name': 'Manage campaigns',
        'description': 'Allows creating, editing, and deleting campaigns.',
    },
    {
        'key': 'campaign.start_stop',
        'name': 'Start and stop campaigns',
        'description': 'Allows starting, pausing, and stopping campaigns.',
    },
    {
        'key': 'campaign.assign_api_keys',
        'name': 'Assign campaign API keys',
        'description': 'Allows manually assigning API keys to campaigns.',
    },
    {
        'key': 'campaign.assign_tags',
        'name': 'Assign campaign tags',
        'description': 'Allows manually assigning tags to campaigns.',
    },
    {
        'key': 'campaign.assign_androids',
        'name': 'Assign Android devices',
        'description': 'Allows manually assigning Android devices to campaigns.',
    },
    {
        'key': 'users.read',
        'name': 'Read users',
        'description': 'Allows viewing users.',
    },
    {
        'key': 'users.manage',
        'name': 'Manage users',
        'description': 'Allows creating, editing, and deleting users.',
    },
    {
        'key': 'api_keys.read',
        'name': 'Read API keys',
        'description': 'Allows viewing API keys.',
    },
    {
        'key': 'api_keys.manage',
        'name': 'Manage API keys',
        'description': 'Allows creating, editing, and deleting API keys.',
    },
    {
        'key': 'tags.read',
        'name': 'Read tags',
        'description': 'Allows viewing tags.',
    },
    {
        'key': 'tags.manage',
        'name': 'Manage tags',
        'description': 'Allows creating, editing, and deleting tags.',
    },
    {
        'key': 'androids.read',
        'name': 'Read Android devices',
        'description': 'Allows viewing Android devices.',
    },
    {
        'key': 'androids.manage',
        'name': 'Manage Android devices',
        'description': 'Allows creating, editing, and deleting Android devices.',
    },
]

DEFAULT_PERMISSION_KEYS = [item['key'] for item in DEFAULT_PERMISSIONS]
