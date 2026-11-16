import { createApp } from './server/app.ts';

const PORT = Number(process.env.PORT || 3000);

createApp()
  .then(({ app }) => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`KWS Academy server listening on http://0.0.0.0:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to start KWS Academy server:', err);
    process.exit(1);
  });
