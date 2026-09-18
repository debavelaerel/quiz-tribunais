// URL assinada pro PDF do laudo guardado no S3 (ver services/laudo-pdf/s3.py,
// quem sobe o objeto). Usado só por app/api/laudo/[token]/route.ts — o link
// estável que vai pro CRM nunca expira porque gera uma URL nova a cada
// acesso; essa aqui é a de curta duração, só pro tempo do redirect.
//
// Nomes de env var próprios (LAUDO_S3_*), não os padrão do SDK
// (AWS_ACCESS_KEY_ID/AWS_REGION/etc.), pelo mesmo motivo do lado Python
// (services/laudo-pdf/s3.py, comentário no topo): a Vercel injeta as
// PRÓPRIAS AWS_* ambiente (região/identidade da function, não credencial de
// bucket nenhuma) em toda function — se o client detectasse credenciais
// via essas env vars padrão, esquecer de configurar uma LAUDO_S3_* faria a
// assinatura sair "válida" só que com uma credencial sem permissão nenhuma
// no nosso bucket, em vez de simplesmente não funcionar de um jeito óbvio.
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const _VARS = ['LAUDO_S3_BUCKET', 'LAUDO_S3_REGION', 'LAUDO_S3_ACCESS_KEY_ID', 'LAUDO_S3_SECRET_ACCESS_KEY'] as const

export function s3Configurado(): boolean {
  return _VARS.every((v) => Boolean(process.env[v]))
}

function cliente(): S3Client {
  return new S3Client({
    region: process.env.LAUDO_S3_REGION,
    credentials: {
      accessKeyId: process.env.LAUDO_S3_ACCESS_KEY_ID ?? '',
      secretAccessKey: process.env.LAUDO_S3_SECRET_ACCESS_KEY ?? '',
    },
  })
}

// 5 minutos: tempo de sobra pro navegador seguir o redirect, sem deixar a
// URL assinada viva por mais tempo do que o necessário caso vaze de algum
// jeito (log, proxy, etc.) — bem menor que o teto de 7 dias do protocolo.
const EXPIRA_EM_SEGUNDOS = 300

export async function urlAssinadaDoLaudo(s3Key: string): Promise<string> {
  const bucket = process.env.LAUDO_S3_BUCKET
  if (!bucket) throw new Error('LAUDO_S3_BUCKET não configurado')
  const comando = new GetObjectCommand({ Bucket: bucket, Key: s3Key })
  return getSignedUrl(cliente(), comando, { expiresIn: EXPIRA_EM_SEGUNDOS })
}
