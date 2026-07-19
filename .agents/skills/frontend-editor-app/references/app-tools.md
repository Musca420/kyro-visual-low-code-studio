# Application operations

- `add_page {name,path}`, `update_page {pageId,name?,path?}`, `remove_page {pageId,confirmed:true}`.
- `set_project_property {property,value}` for supported top-level settings.
- `set_app_config {patch}` for offline, authentication, roles, storage, notifications and environment declarations.
- `set_export_config {patch}` for web, PWA or Android target settings.
- Build navigation with event and navigate nodes; build modal screens with openModal.

Removing a page must also remove or repair dependent flows. Destructive actions require explicit confirmation.
