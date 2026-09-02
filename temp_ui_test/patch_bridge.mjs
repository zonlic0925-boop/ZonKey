import fs from 'fs';
const f = 'C:/Users/Zonlic/Desktop/ZonKey/server_bridge.py';
let t = fs.readFileSync(f, 'utf-8');
if (!t.includes('backend_p3_tools')) {
    t = t.replace('import backend_convert_tools', 'import backend_convert_tools\nimport backend_p3_tools');
    t = t.replace('app.include_router(backend_convert_tools.router)', 'app.include_router(backend_convert_tools.router)\napp.include_router(backend_p3_tools.router)');
    fs.writeFileSync(f, t);
}
