import { html, render } from 'https://unpkg.com/htm/preact/standalone.module.js'

render(html`<h1>Hello from "${document.location.pathname}"</h1>`, document.getElementById('app-root'))
