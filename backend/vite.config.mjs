import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const reactPath = path.resolve(__dirname, 'node_modules/react');
const reactDomPath = path.resolve(__dirname, 'node_modules/react-dom');
const rootNodeModules = path.resolve(rootDir, 'node_modules');

export default defineConfig({
    plugins: [
        laravel({
            input: ['resources/js/app.tsx', 'resources/css/app.css'],
            refresh: true,
        }),
        react(),
    ],
    resolve: {
        alias: {
            react: reactPath,
            'react-dom': reactDomPath,
            '@': path.resolve(rootDir, 'src'),
            'date-fns': path.resolve(rootNodeModules, 'date-fns'),
            'maplibre-gl': path.resolve(rootNodeModules, 'maplibre-gl'),
            'react-icons': path.resolve(rootNodeModules, 'react-icons'),
            'react-map-gl/maplibre': path.resolve(rootNodeModules, 'react-map-gl/dist/maplibre.js'),
            zustand: path.resolve(rootNodeModules, 'zustand'),
        },
        dedupe: ['react', 'react-dom', 'maplibre-gl', 'react-map-gl'],
    },
    optimizeDeps: {
        include: ['maplibre-gl', 'react-map-gl/maplibre'],
        exclude: ['leaflet', 'react-leaflet'],
    },
});
