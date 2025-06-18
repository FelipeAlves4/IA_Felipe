require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const port = 8000;

app.use(cors());
app.use(express.json());
app.use(express.static('static'));
const upload = multer();

// Verificar API Key
if (!process.env.GEMINI_API_KEY) {
    console.error('ERRO: GEMINI_API_KEY não encontrada no .env');
    process.exit(1);
}

// Instanciar o cliente Gemini com modelos gratuitos
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const textModel = genAI.getGenerativeModel({ model: 'models/gemini-pro' });
const imageModel = genAI.getGenerativeModel({ model: 'models/gemini-pro-vision' });  // Gratuito

async function fileToGenerativePart(file) {
    return {
        inlineData: {
            data: file.buffer.toString('base64'),
            mimeType: file.mimetype,
        },
    };
}

async function gerarResposta(input, isImage = false, linguagem = '') {
    try {
        const model = isImage ? imageModel : textModel;
        let result1, result2;

        if (isImage) {
            const imagePart = await fileToGenerativePart(input);

            const prompt1 = "Analise este código ou diagrama de programação. Liste os principais conceitos, padrões de projeto e boas práticas.";
            const prompt2 = "Explique o conteúdo da imagem em detalhes técnicos: estrutura, lógica, possíveis melhorias e exemplos práticos.";

            result1 = await model.generateContent([prompt1, imagePart]);
            result2 = await model.generateContent([prompt2, imagePart]);
        } else {
            const prompt1 = `Análise da questão:

"${input}"

Linguagem: ${linguagem}

Inclua:
- Conceitos principais
- Documentação útil
- Exemplos práticos
- Boas práticas em Markdown`;

            const prompt2 = `Aula sobre "${input}" em ${linguagem}:

- Conceitos
- Código comentado
- Boas práticas
- Exercícios
- Cheatsheet

Formato: Markdown.`;

            result1 = await model.generateContent(prompt1);
            result2 = await model.generateContent(prompt2);
        }

        const resposta = {
            links: result1.response.text(),
            aula: result2.response.text()
        };

        return resposta;
    } catch (error) {
        console.error('Erro na IA:', error);
        throw new Error('Falha ao gerar resposta');
    }
}

// Endpoint para perguntas de texto
app.post('/perguntar', async (req, res) => {
    try {
        const { texto, linguagem } = req.body;

        if (!texto) {
            return res.status(400).json({ erro: 'Texto não informado' });
        }

        const resposta = await gerarResposta(texto, false, linguagem || '');
        res.json(resposta);
    } catch (error) {
        res.status(500).json({ erro: error.message });
    }
});

// Endpoint para upload de imagem
app.post('/processar-imagem', upload.single('imagem'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ erro: 'Nenhuma imagem enviada' });
        }

        const resposta = await gerarResposta(req.file, true);
        res.json(resposta);
    } catch (error) {
        res.status(500).json({ erro: error.message });
    }
});

// Inicialização do servidor
app.listen(port, () => {
    console.log(`Servidor rodando: http://localhost:${port}`);
});
