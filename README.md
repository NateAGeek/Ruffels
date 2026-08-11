# Ruffles

Ruffles is a local TypeScript and TSX structure explorer. Select a source file to parse it with SWC in the Tauri backend, then inspect its typed declaration or JSX render tree in the React Flow canvas.

## Development

```sh
pnpm tauri dev
```

The source file remains local. The backend sends a compact graph containing AST node kinds, source spans, relationships, and parser diagnostics to the frontend; it does not send the complete SWC AST.

This template should help get you started developing with Tauri, React and Typescript in Vite.

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
