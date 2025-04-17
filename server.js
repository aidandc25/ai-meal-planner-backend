
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const OpenAI = require('openai');

dotenv.config();
const app = express();
const port = 5000;

app.use(cors());
app.use(express.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const allergenMap = {
  gluten: ["wheat", "flour", "bread", "pasta", "barley", "rye", "soy sauce", "breadcrumbs", "crackers"],
  dairy: ["milk", "cheese", "butter", "cream", "yogurt", "casein"],
  nuts: ["almonds", "peanuts", "cashews", "walnuts", "hazelnuts", "pecans", "nut butter"],
  soy: ["soy", "soybeans", "tofu", "soy sauce", "edamame"],
  eggs: ["eggs", "mayonnaise", "meringue", "egg whites"],
  shellfish: ["shrimp", "crab", "lobster", "scallops", "clams", "mussels"]
};

function expandAllergens(input) {
  if (!input) return [];
  const keywords = input.toLowerCase().split(/[,\s]+/);
  const result = new Set();
  for (const keyword of keywords) {
    if (allergenMap[keyword]) {
      allergenMap[keyword].forEach(item => result.add(item));
    } else {
      result.add(keyword);
    }
  }
  return Array.from(result).join(', ');
}

app.post('/api/mealplan', async (req, res) => {
  const { planLength, mealsPerDay, preferences, goal, budget, allergies } = req.body;
  const expandedAllergens = expandAllergens(allergies);
  const seedNote = "Seed_" + Date.now();

  const jsonPrompt = `
You are a precise meal planning assistant. Return a valid JSON meal plan.

USER PROFILE:
- Plan length: ${planLength}
- Meals per day: ${mealsPerDay}
- Preferences: ${preferences.join(', ') || 'None'}
- Goal: ${goal || 'None'}
- Budget: ${budget || 'None'}
- Allergies (must be avoided): ${expandedAllergens || 'None'}

AVOID THESE INGREDIENTS: ${expandedAllergens || 'None'}

Instructions:
- Each meal should be unique and vary from past runs, even if criteria are the same.
- Use your creativity to offer variety across days and meal types.
- Include slightly different options and change up the order.
- This seed can help you add variety: ${seedNote}

Meal format:
{
  "days": [
    {
      "day": "Day 1",
      "meals": [
        {
          "type": "Breakfast",
          "title": "Oatmeal with Berries",
          "ingredients": ["Rolled oats", "Almond milk", "Blueberries"],
          "steps": [
            "1. Combine oats and milk in pot.",
            "2. Bring to a simmer for 5 min.",
            "3. Add blueberries and cook for 2 more minutes.",
            "4. Stir gently and serve."
          ]
        }
      ]
    }
  ],
  "groceryList": {
    "Produce": [],
    "Grains": [],
    "Protein": [],
    "Spices": [],
    "Other": []
  }
}

Return ONLY JSON with diverse options. Do NOT repeat the same meals or order every time.
`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      temperature: 0.7,
      messages: [
        { role: "system", content: "You generate JSON meal plans. Focus on variety and dietary safety." },
        { role: "user", content: jsonPrompt }
      ]
    });

    const raw = completion.choices[0].message.content.trim();
    const jsonStart = raw.indexOf('{');
    const jsonData = raw.slice(jsonStart);
    const data = JSON.parse(jsonData);

    res.json({ result: data });
  } catch (err) {
    console.error("❌ OpenAI JSON error:", err);
    res.status(500).json({ error: "Failed to get structured meal plan." });
  }
});

app.listen(port, () => {
  console.log(`🚀 Server running on http://localhost:${port}`);
});
