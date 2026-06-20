require('dotenv').config({ path: '.env.local' });
fetch('https://generativelanguage.googleapis.com/v1beta/models?key=' + process.env.GEMINI_API_KEY)
  .then(res => res.json())
  .then(data => {
      if (data.models) {
          console.log("Available models:");
          data.models.forEach(m => console.log(m.name, m.supportedGenerationMethods));
      } else {
          console.error("No models found. Error:", data);
      }
  })
  .catch(console.error);
