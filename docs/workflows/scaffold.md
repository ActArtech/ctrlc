# Scaffold apps

## From monorepo

```bash
cd CtrlC
npm run build
npm run create -- ../my-ctrlc-app
cd ../my-ctrlc-app
npm install
npm run dev
# http://localhost:3040
```

Creates a React-only Next app based on `examples/next-demo`:

- Section components + content + styles  
- SectionPack provider, boundaries, API route  
- Config pointing at monorepo packages via `file:` (when scaffolded from this repo)

## After scaffold

1. Rename brand copy in `src/content/`  
2. Adjust sections / config ids  
3. `ctrlc validate --cwd .`  
4. Optional: `ctrlc scan` if you add many new section files  

## Related

- [Getting started](../guide/getting-started.md)
