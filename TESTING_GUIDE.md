# Quick Reference: How to Test Each Task

## Prerequisites
```bash
npm install
npm run db:push  # Ensure database is synced
```

---

## TASK 1: Test Auth Workflow

### Test Signup
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testuser@example.com",
    "password": "TestPass123!@#",
    "name": "Test User"
  }'
```

**Expected Response (201):**
```json
{
  "success": true,
  "accessToken": "eyJ...",
  "refreshToken": "eyJ...",
  "user": {
    "id": 1,
    "email": "testuser@example.com",
    "name": "Test User"
  }
}
```

### Test Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testuser@example.com",
    "password": "TestPass123!@#"
  }'
```

### Check Database
```bash
# Via Prisma Studio
npm run db:studio

# Query: SELECT * FROM users;
# Verify: email, passwordHash, name fields populated
```

---

## TASK 2: Test Report Generation

### Create a Report
```bash
curl -X POST http://localhost:3000/api/reports \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -d '{
    "barcode": "8718215104147"
  }'
```

**Expected Response (201):**
```json
{
  "success": true,
  "report": {
    "id": 1,
    "score": 45,
    "verdict": "moderate risk",
    "summary": "⚠️ Allergen Alert: Contains high sugar...",
    "overallScore": 45,
    "allergenScore": 95,
    "toxicityScore": 85,
    "recallScore": 100,
    "drugInteractionScore": 100,
    "adverseEventScore": 60,
    "nutritionalScore": 35,
    "severityLevel": "moderate",
    "aiAnalysisSummary": "...",
    // 40+ more fields
  },
  "summary": {
    "newsArticles": 5,
    "openfdaFoodRecalls": 2,
    "openfdaDrugRecalls": 0,
    "openfdaFoodAdverseEvents": 1
  }
}
```

### Verify All Columns in Database
```bash
npm run db:studio
# Navigate to: reports table
# Verify columns: score, verdict, summary, overallScore, allergenScore, etc.
```

---

## TASK 3: Test Barcode Detection

### In Browser (Frontend)
1. Open http://localhost:3000
2. In **Scan Panel:**
   - Toggle between "Food" or "Medication"
   - Click "Start camera scan"
   - Point camera at barcode
   - System auto-detects (Browser Barcode API)
   - Confirms: "Detected barcode: 8718215104147"
   - Click "Confirm" button
   - Barcode field fills
   - Click "Run Safety Lookup"

### Via API
```bash
curl -X POST http://localhost:3000/api/lookup \
  -H "Content-Type: application/json" \
  -d '{
    "category": "food",
    "barcode": "8718215104147"
  }'
```

**Expected Response:**
```json
{
  "product": {
    "name": "Coca-Cola Original",
    "brand": "Coca-Cola",
    "ingredients": "Carbonated water...",
    "nutritionalInfo": {
      "calories": 140,
      "sugar_g": 39
    }
  }
}
```

---

## TASK 4: Test AI Insights

### Generate AI Analysis
```bash
# First, create a report (see TASK 2)
# Then use the reportId:

curl -X POST http://localhost:3000/api/analysis/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -d '{
    "reportId": 1
  }'
```

**Expected Response (200):**
```json
{
  "success": true,
  "report": {
    "id": 1,
    "aiAnalysisSummary": "Coca-Cola Original contains 39g of sugar per serving (130% daily value)...",
    "summary": "This product has high sugar content. Consider limiting consumption..."
  },
  "ai": {
    "scores": {
      "overallScore": 45,
      "allergenScore": 100,
      "toxicityScore": 85,
      "recallScore": 100,
      "drugInteractionScore": 100,
      "adverseEventScore": 95,
      "nutritionalScore": 30
    },
    "summary": "High sugar product - not recommended for diabetics",
    "aiAnalysisSummary": "Detailed clinical analysis..."
  }
}
```

### Debug Mode (Show Raw AI Response)
```bash
curl -X POST http://localhost:3000/api/analysis/generate?debug=1 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -d '{"reportId": 1}'

# Response will include rawModelText field with exact AI response
```

---

## Run All Verification Tests

```bash
npm test -- test-all-tasks.test.ts
```

**Output:**
```
✓ test-all-tasks.test.ts (17 tests) 23ms
  ✓ TASK 1: Auth Workflow (4)
  ✓ TASK 2: Report Endpoint (4)
  ✓ TASK 3: Barcode Detection (4)
  ✓ TASK 4: AI Insights (5)

Test Files  1 passed (1)
Tests       17 passed (17)
```

---

## Troubleshooting

### Issue: Featherless returns parse error
**Solution:** Check JSON format in system prompt matches expected schema
```bash
# Debug response
curl -X POST http://localhost:3000/api/analysis/generate?debug=1 ...
# Check rawModelText for malformed JSON
```

### Issue: Barcode detection not working
**Solution:** Browser Barcode Detection API requires:
- HTTPS (or localhost)
- Camera permission granted
- Barcode in focus

### Issue: Reports created but score is null
**Solution:** Verify orchestrate-report.ts has been updated
```bash
# Check that overallScore is being set
git diff lib/reports/orchestrate-report.ts
```

---

## Environment Variables Required

```env
# Auth
NEXTAUTH_URL=http://localhost:3000
AUTH_SECRET=replace-with-random-secret

# Database
POSTGRES_URL="postgresql://user:pass@host:5432/db"
DATABASE_URL="postgresql://user:pass@host:5432/db"

# AI Analysis
FEATHERLESS_API_KEY=rc_33c6a88950b2391dab2008d485338d0eeeffa83fed40d50f1b9ab19029ac4897
FEATHERLESS_BASE_URL=https://api.featherless.ai/v1
FEATHERLESS_MODEL=meta-llama/Meta-Llama-3.1-70B-Instruct

# External APIs (optional)
OPENAI_API_KEY=...
OPENFOODFACTS_BASE_URL=https://world.openfoodfacts.org/api/v0
```

---

## Success Indicators

✅ **Auth:** Can register, login, receive JWT tokens  
✅ **Reports:** All fields populated, score/verdict/summary present  
✅ **Barcode:** Camera detects, category selected, API lookup works  
✅ **AI:** Featherless returns structured JSON with scores  

---

**Document Updated:** May 10, 2026
