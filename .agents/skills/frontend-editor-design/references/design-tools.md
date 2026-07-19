# Design operations

- Structure: `add_component {componentType,name,parentId?}`, `move_component {componentId,parentId?,index?}`, `reorder_component {componentId,index}`, `wrap_component {componentId,componentType,name}`, `remove_component {componentId,confirmed:true}`.
- Content: `set_component_property {componentId,property,value}`.
- Layout: `resize_component {componentId,width,height}`, `set_responsive_style {componentId,breakpoint,property,value}`.
- States: `set_component_state_style {componentId,state,property,value}` where state is hover, focus, active or disabled.
- Meaning: `set_component_accessibility {componentId,label,role?}` and `set_component_intent {componentId,role,action,entity,expectedResult,requiredStates,permissions}`.
- Theme: `set_theme_token {token,value}`.

Supported component types include container, stack, grid, spacer, text, title, link, image, icon, button, input, textarea, select, checkbox, radio, form, card, list, table, navbar, tabs, modal, loader, empty, alert, toast, header, sidebar, hero, footer, section, carousel, gallery, menu, breadcrumb, accordion, drawer, tooltip, pagination, upload, avatar, badge, progress, skeleton, chart, calendar, map, audio, video and reusable.
