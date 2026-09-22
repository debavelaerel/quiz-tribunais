// URL assinada pro PDF do laudo guardado no S3 (ver services/laudo-pdf/s3.py,
// quem sobe o objeto). Usado só por app/api/laudo/[token]/route.ts — o link
// estável que vai pro CRM nunca expira porque gera uma URL nova a cada
// acesso; essa aqui é a de curta duração, só pro tempo do redirect.
//
// Nomes de env var próprios (BUCKET_NAME/REGION/ACCESS_KEY/SECRET_KEY), não
// os padrão do SDK (AWS_ACCESS_KEY_ID/AWS_REGION/etc.), pelo mesmo motivo do
// lado Python (services/laudo-pdf/s3.py, comentário no topo): a Vercel
// injeta as PRÓPRIAS AWS_* ambiente (região/identidade da function, não
// credencial de bucket nenhuma) em toda function — se o client detectasse
// credenciais via essas env vars padrão, esquecer de configurar uma das
// nossas faria a assinatura sair "válida" só que com uma credencial sem
// permissão nenhuma no nosso bucket, em vez de simplesmente não funcionar de
// um jeito óbvio.
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const _VARS = ['BUCKET_NAME', 'REGION', 'ACCESS_KEY', 'SECRET_KEY'] as const

export function s3Configurado(): boolean {
  return _VARS.every((v) => Boolean(process.env[v]))
}

function cliente(): S3Client {
  return new S3Client({
    region: process.env.REGION,
    credentials: {
      accessKeyId: process.env.ACCESS_KEY ?? '',
      secretAccessKey: process.env.SECRET_KEY ?? '',
    },
  })
}

// 5 minutos: tempo de sobra pro navegador seguir o redirect, sem deixar a
// URL assinada viva por mais tempo do que o necessário caso vaze de algum
// jeito (log, proxy, etc.) — bem menor que o teto de 7 dias do protocolo.
const EXPIRA_EM_SEGUNDOS = 300

export async function urlAssinadaDoLaudo(s3Key: string): Promise<string> {
  const bucket = process.env.BUCKET_NAME
  if (!bucket) throw new Error('BUCKET_NAME não configurado')
  const comando = new GetObjectCommand({ Bucket: bucket, Key: s3Key })
  return getSignedUrl(cliente(), comando, { expiresIn: EXPIRA_EM_SEGUNDOS })
}
