import { jsxRenderer } from 'hono/jsx-renderer'

export const renderer = jsxRenderer(({ children }) => {
  return (
    <html lang="ja">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>四万十町グルメガイド - 高校生おすすめの飲食店&写真スポット</title>
        <meta name="description" content="四万十町を汽車で訪れる観光客のための、地元高校生おすすめの飲食店と写真スポットを紹介するアプリ" />
        
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet" />

        <link href="/static/style.css" rel="stylesheet" />
      </head>
      <body class="bg-gray-50">
        {children}
        
        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script src="/static/app.js"></script>
      </body>
    </html>
  )
})
