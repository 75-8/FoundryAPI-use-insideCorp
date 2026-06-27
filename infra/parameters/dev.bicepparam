using './main.bicep'

param location = 'japaneast'
param env = 'dev'
param tenantId = 'YOUR_TENANT_ID_HERE'

// 許可する OID をセミコロン区切りで指定 (例: "11111111-1111-1111-1111-111111111111;22222222-2222-2222-2222-222222222222")
param allowedOids = 'INSERT_ALLOWED_OIDS_HERE'

// 許可する IP CIDR をセミコロン区切りで指定 (例: "192.168.1.0/24;10.0.0.0/8;203.0.113.10/32")
param allowedCidrs = 'INSERT_ALLOWED_CIDRS_HERE'

param modelName = 'gpt-5.4'
param modelCapacity = 30000
