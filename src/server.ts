import app from "@/app";
import { env } from "@/config";

const port = env.PORT;
const server = app.listen(port, () => {
  /* eslint-disable no-console */
  console.log(`Server listening: http://localhost:${port}`);
  /* eslint-enable no-console */
});

server.on("error", (err) => {
  if ("code" in err && err.code === "EADDRINUSE") {
    console.error(`Port ${env.PORT} is already in use. Please choose another port or stop the process using it.`);
  }
  else {
    console.error("Failed to start server:", err);
  }
  process.exit(1);
});
