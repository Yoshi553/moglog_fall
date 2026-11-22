# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

React + Vite

このプロジェクトは、ReactとViteを使用して開発するための基本的なテンプレートです。

HMR（Hot Module Replacement）に対応しており、コードを変更すると、ページ全体を再読み込みすることなく変更内容を反映できます。また、ESLintによるコードチェックの仕組みも備えています。

React用の公式プラグイン

Viteでは、Reactを使用するための2種類の公式プラグインが用意されています。

* @vitejs/plugin-react：Oxcを使用してコードの変換などを行うプラグインです。
* @vitejs/plugin-react-swc：SWCを使用してコードの変換などを行うプラグインです。

React Compiler

このテンプレートでは、開発時やビルド時の処理速度への影響を考慮し、React Compilerは有効になっていません。

React Compilerを導入する場合は、Reactの公式ドキュメントを参照してください。

ESLintの設定の拡張

本格的なアプリケーションを開発する場合は、TypeScriptの導入と、型情報を利用したESLintのルール設定が推奨されています。

TypeScriptを使用することで、変数や関数などのデータ型を明確にでき、開発時にエラーを発見しやすくなります。

TypeScriptを導入する場合は、ViteのReact + TypeScript用テンプレートや、typescript-eslintの公式ドキュメントを参考にしてください。