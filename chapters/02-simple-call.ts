// OpenAIのChat Completions APIを呼び出す最小限の実装
async function callOpenAI() {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-5-mini',
      messages: [
        { role: 'user', content: 'TypeScriptについて簡潔に説明してください。' }
      ],
    }),
  });

  const data = await response.json();
  console.log(data.choices[0].message.content);
}

// 関数を実行
callOpenAI();