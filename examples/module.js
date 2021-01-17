import {
  html,
  render
} from "https://unpkg.com/htm/preact/standalone.module.js";

import { content } from "./nested.js";

render(
  html`
    <h1>Hello from "${document.location.pathname}"</h1>
    <span>${content}</span>
  `,
  document.getElementById("app-root")
);
