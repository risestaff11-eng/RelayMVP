import { env } from "cloudflare:workers";

export function getFilesBucket() {
  const runtime = env as unknown as { FILES?: R2Bucket };
  if (!runtime.FILES) throw new Error("Хранилище файлов временно недоступно");
  return runtime.FILES;
}
