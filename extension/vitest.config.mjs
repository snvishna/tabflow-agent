import { defineConfig } from 'vitest/config';

// Unit tests only; browser end-to-end suites in e2e/ run via `npm run test:e2e`
export default defineConfig({
    test: {
        include: ['tests/**/*.test.js']
    }
});
