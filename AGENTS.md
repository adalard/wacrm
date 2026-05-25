<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:rtk-agent-rules -->
# RTK - Rust Token Killer Integration

**Usage**: High-performance CLI proxy for shell commands. Always prefix shell commands with `rtk` to minimize token consumption and filter output.

Examples:
- `rtk git status`
- `rtk npm run typecheck`
- `rtk npm run test`
- `rtk grep "pattern" src/`
- `rtk find "*.ts" src/`  # Preferred over 'ls' on Windows due to PS alias constraints
- `rtk find "*.*" src/lib/` # Lists all files in src/lib in a compact tree
<!-- END:rtk-agent-rules -->

