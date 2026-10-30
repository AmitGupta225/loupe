# Loupe

Loupe is a legal contract review application. It reads a contract, breaks it
into clauses, finds possible risks, and shows the related text from the
original document.

You can review PDF, DOCX, and TXT files, paste contract text, or provide a
document URL. The source document and quoted clauses stay unchanged, so each
finding can be checked against the agreement.

## What it can do

- Read PDF, DOCX, and TXT files
- Accept pasted text and document URLs
- Split a contract into sections and clauses
- Find defined terms and section references
- Review common risk areas such as indemnity, liability limits, termination,
  intellectual property, non-compete, payment, and governing law
- Show the exact quote behind a finding
- Show the quote's position in the source document
- Suggest a possible redline
- Show the overall risk position of the contract
- Stream analysis progress to the frontend
- Translate the application interface into English, Hindi, or Bengali

The source document and quoted clauses remain in their original language.

## Project structure

```text
loupe/
├── backend/
│   ├── app/
│   │   ├── api/v1/          # API routes, uploads, streaming, chat, and translation
│   │   ├── agents/          # Analysis state, prompts, nodes, and graph
│   │   ├── core/            # Settings, model client, and error handling
│   │   ├── schemas/         # Contract and analysis data models
│   │   └── services/        # Parsing, clause splitting, retrieval, and translation
│   └── tests/               # Backend tests
├── frontend/
│   └── src/
│       ├── components/      # Main application screens and UI components
│       ├── context/         # Application, theme, accessibility, and language state
│       ├── hooks/           # Reusable React hooks
│       ├── services/        # API, export, storage, and translation helpers
│       ├── styles/          # Application styles
│       └── __tests__/       # Frontend tests
├── .gitignore
├── LICENSE
└── README.md
```

## How the analysis works

The backend reviews a contract in these steps:

1. Read and normalise the document.
2. Split the document into clauses and record character positions.
3. Find defined terms and document details.
4. Select clauses that need a closer review.
5. Find related sections, definitions, and override clauses.
6. Ask the configured language model for a structured risk review.
7. Check every returned quote against the original document.
8. Prepare the final contract summary and send progress events to the UI.

The model is called through Modal's OpenAI-compatible endpoint.

```text
Model:    meta-models/Muse-Spark-Open-816B-A42B
Endpoint: https://your-modal-shared-endpoint.modal.run/v1
```

## Requirements

- Python 3.11 or newer
- Node.js 18 or newer
- npm
- A Modal API key for live contract analysis
- `curl` for the Google translation request

## Run the backend

Create a virtual environment and install the backend packages:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Update `backend/.env` with your Modal settings:

```env
MODAL_API_KEY=your-modal-api-key
MODAL_BASE_URL=https://your-modal-shared-endpoint.modal.run/v1
MODEL_ID=meta-models/Muse-Spark-Open-816B-A42B
```

Then start the API:

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The backend will be available at:

- `http://localhost:8000`
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`
- API health check: `http://localhost:8000/api/v1/health`

## Run the frontend

Open another terminal:

```bash
cd frontend
npm install
npm run dev
```

Open the Vite URL shown in the terminal. It is normally:

```text
http://localhost:5173
```

The frontend uses `http://localhost:8000` as the backend URL by default. To
use a different backend:

```bash
VITE_API_BASE_URL=http://localhost:8000 npm run dev
```

## Useful commands

### Backend

```bash
cd backend
.venv/bin/pytest
```

To run one test file:

```bash
.venv/bin/pytest tests/test_chunker.py
```

The test suite uses fixed model responses, so it does not make live model
requests or use Modal credits.

### Frontend

```bash
cd frontend
npm test
npm run test:watch
npm run test:coverage
npm run build
npm run preview
```

## Main API areas

The API is available under `/api/v1`:

| Area | Purpose |
| --- | --- |
| `health` | Check whether the service is running |
| `analyze` | Analyse contracts, uploads, and streaming progress |
| `chat` | Ask questions in the analysis workspace |
| `scrape` | Read a document from a URL |
| `translate` | Translate application text through Google Translate |

The root health route and automatic API documentation are also available.

## Translation

The interface is translated when the user selects a language. It does not
depend on a separate translation file for every button and label.

The frontend collects visible application text and sends it in batches to the
backend. The backend calls Google's free public translation endpoint and
returns the translated text. Results are cached for the selected language.

Contract text and quoted evidence are left alone. The rest of the interface,
including buttons, labels, explanations, status messages, and analysis text,
can be translated.

## Safety notes

- Do not put API keys in the repository.
- Keep real contracts and other private documents out of Git.
- Use a separate development key instead of a production key.
- Check CORS settings before exposing the API on a public server.
- Review the model output before using it for a legal decision.

## License

Loupe is available under the [MIT License](./LICENSE).
