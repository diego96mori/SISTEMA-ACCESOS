# Proyecto de Accesos

## Supabase oficial

Este repositorio trabaja exclusivamente con el proyecto Supabase
`stkgsygonyxtrdhlgusx`:

```text
https://stkgsygonyxtrdhlgusx.supabase.co
```

El frontend toma `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` de
`.env.local`. El proxy de NetBox toma `SUPABASE_URL` y
`SUPABASE_PUBLISHABLE_KEY` de `.env.netbox.local`. Ambos procesos validan la
URL y se detienen si apunta a otro proyecto.

Las claves secretas o `service_role` nunca deben colocarse en variables
`VITE_*`, porque esas variables se incluyen en el navegador.

## Desarrollo local

```bash
npm install
npm run dev
```

Para iniciar también el proxy local de NetBox:

```bash
npm run netbox:proxy
```

## Base de la plantilla

Este proyecto fue creado con React y Vite.

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
