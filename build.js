const esbuild = require('esbuild');

esbuild.build({
    entryPoints: ['src/background.js', 'popup.js', 'dashboard.js', 'src/login.js'],
    bundle: true,
    outdir: 'dist', // Changed from outfile to outdir
    format: 'esm',
    target: ['es2020'],
    define: { 'process.env.NODE_ENV': '"production"' }
}).catch(() => process.exit(1));
