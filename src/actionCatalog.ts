import type { EditorComponent } from "./model";

export type ActionEventCategory = "Pointer" | "Form & input" | "Focus & keyboard" | "Scroll & gestures" | "Lifecycle" | "Device";

export type ActionEventDefinition = {
  id: string;
  label: string;
  description: string;
  category: ActionEventCategory;
  payload: string;
  componentTypes?: EditorComponent["type"][];
  pageOnly?: boolean;
};

const formTypes: EditorComponent["type"][] = ["form"];
const inputTypes: EditorComponent["type"][] = ["input", "textarea", "select", "checkbox", "radio", "upload"];
const pointerTypes: EditorComponent["type"][] = [
  "button", "link", "image", "icon", "card", "list", "table", "navbar", "tabs", "modal", "header", "sidebar", "hero", "section", "carousel", "gallery", "menu", "accordion", "drawer", "calendar", "map", "audio", "video", "container", "stack", "grid", "reusable",
];
const scrollTypes: EditorComponent["type"][] = ["list", "table", "carousel", "gallery", "menu", "sidebar", "section", "container", "stack", "grid"];

export const actionEventCatalog: ActionEventDefinition[] = [
  { id: "click", label: "Click / tap", description: "Run when the element is clicked or tapped.", category: "Pointer", payload: "pointer event", componentTypes: pointerTypes },
  { id: "doubleClick", label: "Double click / tap", description: "Run after two quick taps.", category: "Pointer", payload: "pointer event", componentTypes: pointerTypes },
  { id: "longPress", label: "Long press", description: "Run after the element is held for 600 ms.", category: "Pointer", payload: "pointer position and duration", componentTypes: pointerTypes },
  { id: "pointerEnter", label: "Pointer enters", description: "Run when a mouse or pen enters the element.", category: "Pointer", payload: "pointer event", componentTypes: pointerTypes },
  { id: "pointerLeave", label: "Pointer leaves", description: "Run when a mouse or pen leaves the element.", category: "Pointer", payload: "pointer event", componentTypes: pointerTypes },
  { id: "submit", label: "Form submitted", description: "Run after form validation succeeds.", category: "Form & input", payload: "form record", componentTypes: formTypes },
  { id: "recordUpdate", label: "Record updated", description: "Run when a person completes or edits an item in this data view.", category: "Form & input", payload: "updated record", componentTypes: ["list", "table"] },
  { id: "recordDelete", label: "Record deleted", description: "Run after a person confirms deletion from this data view.", category: "Form & input", payload: "record to delete", componentTypes: ["list", "table"] },
  { id: "input", label: "Value typed", description: "Run while the value changes.", category: "Form & input", payload: "current value", componentTypes: inputTypes },
  { id: "change", label: "Value committed", description: "Run after a value or selection is committed.", category: "Form & input", payload: "current value", componentTypes: inputTypes },
  { id: "focus", label: "Focus received", description: "Run when keyboard or pointer focus enters.", category: "Focus & keyboard", payload: "focus event", componentTypes: [...inputTypes, ...pointerTypes] },
  { id: "blur", label: "Focus lost", description: "Run when focus leaves the element.", category: "Focus & keyboard", payload: "focus event", componentTypes: [...inputTypes, ...pointerTypes] },
  { id: "keyDown", label: "Key pressed", description: "Run when a key is pressed while the element has focus.", category: "Focus & keyboard", payload: "key, modifiers and repeat", componentTypes: [...inputTypes, ...pointerTypes] },
  { id: "scroll", label: "Scrolled", description: "Run while this scrollable element moves.", category: "Scroll & gestures", payload: "scroll position", componentTypes: scrollTypes },
  { id: "swipeLeft", label: "Swipe left", description: "Run after a horizontal swipe to the left.", category: "Scroll & gestures", payload: "distance, duration and velocity", componentTypes: [...pointerTypes, ...scrollTypes] },
  { id: "swipeRight", label: "Swipe right", description: "Run after a horizontal swipe to the right.", category: "Scroll & gestures", payload: "distance, duration and velocity", componentTypes: [...pointerTypes, ...scrollTypes] },
  { id: "pageLoad", label: "Page opened", description: "Run whenever this page becomes active.", category: "Lifecycle", payload: "page", pageOnly: true },
  { id: "pageVisible", label: "Page becomes visible", description: "Run when the app returns to the foreground.", category: "Lifecycle", payload: "visibility state", pageOnly: true },
  { id: "pageHidden", label: "Page becomes hidden", description: "Run when the app goes to the background.", category: "Lifecycle", payload: "visibility state", pageOnly: true },
  { id: "online", label: "Connection restored", description: "Run when the device reconnects.", category: "Device", payload: "network state", pageOnly: true },
  { id: "offline", label: "Connection lost", description: "Run when the device goes offline.", category: "Device", payload: "network state", pageOnly: true },
  { id: "deviceShake", label: "Device shaken", description: "Run after a physical shake on a supported device.", category: "Device", payload: "acceleration", pageOnly: true },
];

export function eventsForComponent(type: EditorComponent["type"]) {
  return actionEventCatalog.filter((event) => !event.pageOnly && event.componentTypes?.includes(type));
}

export function pageEvents() {
  return actionEventCatalog.filter((event) => event.pageOnly);
}

export function isComponentEvent(value = "") {
  return actionEventCatalog.some((event) => event.id === value && !event.pageOnly);
}

export function actionEvent(value = "") {
  return actionEventCatalog.find((event) => event.id === value);
}
