const express = require('express');
const path = require('path');
const mysql = require('mysql2');
const bcrypt = require('bcrypt');
const app = express();
const cors = require('cors');
const PORT = process.env.PORT || 40001;

// ===============================
//  Conexão com MySQL
// ===============================
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '123456',
    database: 'saep_db'
});

db.connect(err => {
    if (err) {
        console.log('❌ Erro ao conectar no banco:', err.message);
        return;
    }
    console.log('✅ Conexão com MySQL estabelecida!');
});

function garantirColunaDataMovimentacao() {
    const sql = `
        SELECT COUNT(*) AS total
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'movimentacao'
          AND COLUMN_NAME = 'data_operacao'
    `;

    db.query(sql, (err, results) => {
        if (err) {
            console.log('⚠️ Não foi possível verificar a coluna data_operacao:', err.message);
            return;
        }

        if (results[0].total > 0) {
            return;
        }

        db.query(
            `ALTER TABLE movimentacao
             ADD COLUMN data_operacao DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER id_usuario`,
            alterErr => {
                if (alterErr) {
                    console.log('⚠️ Não foi possível adicionar a coluna data_operacao:', alterErr.message);
                    return;
                }

                console.log('✅ Coluna data_operacao adicionada à tabela movimentacao.');
            }
        );
    });
}

garantirColunaDataMovimentacao();

// ===============================
//  Middlewares
// ===============================
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// ===============================
//  Rotas de páginas
// ===============================
app.get('/', (req, res) =>
    res.sendFile(path.join(__dirname, 'public', 'loginCad.html'))
);
app.get('/login', (req, res) =>
    res.sendFile(path.join(__dirname, 'public', 'login.html'))
);
app.get('/dash', (req, res) =>
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'))
);
app.get('/cadastro', (req, res) =>
    res.sendFile(path.join(__dirname, 'public', 'cadastroProdutos.html'))
);
app.get('/gerenciador', (req, res) =>
    res.sendFile(path.join(__dirname, 'public', 'gerenciador.html'))
);
app.get('/mover', (req, res) =>
    res.sendFile(path.join(__dirname, 'public', 'movimentacao.html'))
);


app.post('/salvar', async (req, res) => {
    const { nome, senha } = req.body;

    const senhaHash = await bcrypt.hash(senha, 10);

    const sql = 'INSERT INTO usuario (nome, senha) VALUES (?, ?)';

    db.query(sql, [nome, senhaHash], (err, results) => {
        if (err) {
            console.error('❌ Erro ao inserir dados:', err);
            return res.status(500).send('Erro ao salvar a tarefa.');
        }

        console.log('✅ usuario cadastrado com sucesso!');
        res.send('usuario adicionada');
    });
});


app.post('/login', (req, res) => {
    const { nome, senha } = req.body;

    if (!nome || !senha) {
        return res.status(400).json({ error: "Preencha todos os campos!" });
    }

    const sql = "SELECT * FROM usuario WHERE nome = ?";

    db.query(sql, [nome], async (err, results) => {
        if (err) {
            console.error("❌ Erro ao consultar banco:", err);
            return res.status(500).json({ error: "Erro no servidor." });
        }

        // Nenhum usuário encontrado
        if (results.length === 0) {
            return res.status(401).json({ error: "Usuário ou senha incorretos!" });
        }

        const usuario = results[0];

        const senhaValida =
            await bcrypt.compare(
                senha,
                usuario.senha
            );

        if (!senhaValida) {
            return res.status(401).json({
                error: "Usuário ou senha incorretos!"
            });
        }

        console.log("✅ Login realizado com sucesso:", nome);
        return res.json({ message: "Login autorizado!", usuario: nome });
    });
});

// Criar produto
app.post('/CriarProdutos', (req, res) => {
    const {
        categoria,
        nome,
        descricao,
        estoque_minimo,
        estoque_atual,
        codigo_interno
    } = req.body;

    const sql = `
    INSERT INTO produto 
    (categoria, nome, descricao, estoque_minimo, estoque_atual, codigo_interno)
    VALUES (?, ?, ?, ?, ?, ?)
  `;

    db.query(sql, [categoria, nome, descricao, estoque_minimo, estoque_atual, codigo_interno],
        (err, result) => {
            if (err) {
                console.error("Erro ao cadastrar produto:", err);
                return res.status(500).json({ erro: "Erro ao cadastrar produto", detalhe: err });
            }
            return res.status(201).json({ mensagem: "Produto cadastrado com sucesso!", id: result.insertId });
        }
    );
});

// Listar todos os produtos
app.get('/ListarProdutos', (req, res) => {
    const sql = "SELECT produto.*, categoria AS categoria_nome FROM produto";

    db.query(sql, (err, results) => {
        if (err) {
            return res.status(500).json({ erro: "Erro ao buscar produtos" });
        }
        res.json(results);
    });
});

app.get('/produtos', (req, res) => {
    const sql = "SELECT produto.*, categoria AS categoria_nome FROM produto";

    db.query(sql, (err, results) => {
        if (err) {
            return res.status(500).json({ erro: "Erro ao buscar produtos" });
        }
        res.json(results);
    });
});

app.get('/usuarios', (req, res) => {
    db.query('SELECT id_usuario, nome FROM usuario', (err, results) => {
        if (err) {
            return res.status(500).json({ erro: 'Erro ao buscar usuários' });
        }
        res.json(results);
    });
});

app.get('/movimentacoes', (req, res) => {
    const sql = `
        SELECT
            m.id_movimentacao,
            m.tipo,
            m.quantidade,
            m.observacoes,
            m.id_produto,
            p.nome AS produto,
            m.id_usuario,
            u.nome AS responsavel,
            m.data_operacao
        FROM movimentacao m
        INNER JOIN produto p ON p.id_produto = m.id_produto
        INNER JOIN usuario u ON u.id_usuario = m.id_usuario
        ORDER BY m.data_operacao DESC, m.id_movimentacao DESC
    `;

    db.query(sql, (err, results) => {
        if (err) {
            return res.status(500).json({ erro: 'Erro ao buscar histórico de movimentações.' });
        }

        res.json(results);
    });
});

app.post('/movimentacoes', (req, res) => {
    const { tipo, quantidade, observacoes, id_produto, id_usuario } = req.body;

    if (!tipo || !quantidade || !id_produto || !id_usuario) {
        return res.status(400).json({ erro: 'Preencha todos os campos obrigatórios.' });
    }

    const qtd = Number(quantidade);

    if (!Number.isInteger(qtd) || qtd <= 0) {
        return res.status(400).json({ erro: 'Quantidade inválida.' });
    }

    const ajuste = tipo === 'entrada' ? qtd : -qtd;

    db.beginTransaction(err => {
        if (err) {
            return res.status(500).json({ erro: 'Erro ao iniciar transação.' });
        }

        db.query(
            'SELECT estoque_atual FROM produto WHERE id_produto = ?',
            [id_produto],
            (err, results) => {
                if (err) {
                    return db.rollback(() => {
                        res.status(500).json({ erro: 'Erro ao validar produto.' });
                    });
                }

                if (results.length === 0) {
                    return db.rollback(() => {
                        res.status(404).json({ erro: 'Produto não encontrado.' });
                    });
                }

                const estoqueAtual = Number(results[0].estoque_atual);
                const novoEstoque = estoqueAtual + ajuste;

                if (novoEstoque < 0) {
                    return db.rollback(() => {
                        res.status(400).json({ erro: 'Estoque insuficiente para essa saída.' });
                    });
                }

                db.query(
                    'UPDATE produto SET estoque_atual = ? WHERE id_produto = ?',
                    [novoEstoque, id_produto],
                    updateErr => {
                        if (updateErr) {
                            return db.rollback(() => {
                                res.status(500).json({ erro: 'Erro ao atualizar estoque.' });
                            });
                        }

                        db.query(
                            `INSERT INTO movimentacao (tipo, quantidade, observacoes, id_produto, id_usuario, data_operacao)
                             VALUES (?, ?, ?, ?, ?, NOW())`,
                            [tipo, qtd, observacoes || null, id_produto, id_usuario],
                            (insertErr, insertResult) => {
                                if (insertErr) {
                                    return db.rollback(() => {
                                        res.status(500).json({ erro: 'Erro ao registrar movimentação.' });
                                    });
                                }

                                db.commit(commitErr => {
                                    if (commitErr) {
                                        return db.rollback(() => {
                                            res.status(500).json({ erro: 'Erro ao finalizar movimentação.' });
                                        });
                                    }

                                    return res.status(201).json({
                                        mensagem: 'Movimentação registrada com sucesso!',
                                        movimentacao: {
                                            id_movimentacao: insertResult.insertId,
                                            tipo,
                                            quantidade: qtd,
                                            observacoes: observacoes || null,
                                            id_produto,
                                            id_usuario
                                        }
                                    });
                                });
                            }
                        );
                    }
                );
            }
        );
    });
});

// Buscar produto por ID
app.get('/BuscProdutos/:id', (req, res) => {
    const { id } = req.params;

    db.query("SELECT * FROM produto WHERE id_produto = ?", [id], (err, results) => {
        if (err) {
            return res.status(500).json({ erro: "Erro ao buscar produto" });
        }
        if (results.length === 0) {
            return res.status(404).json({ mensagem: "Produto não encontrado" });
        }
        res.json(results[0]);
    });
});

// Atualizar produto
app.put('/UpProdutos/:id', (req, res) => {
    const { id } = req.params;
    const {
        categoria,
        nome,
        descricao,
        estoque_minimo,
        estoque_atual,
        codigo_interno
    } = req.body;

    const sql = `
    UPDATE produto SET
      categoria = ?,
      nome = ?,
      descricao = ?,
      estoque_minimo = ?,
      estoque_atual = ?,
            codigo_interno = ?
    WHERE id_produto = ?
  `;

    db.query(sql, [
        categoria, nome, descricao, estoque_minimo,
        estoque_atual, codigo_interno, id
    ], (err, result) => {
        if (err) {
            return res.status(500).json({ erro: "Erro ao atualizar produto" });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ mensagem: "Produto não encontrado" });
        }
        res.json({ mensagem: "Produto atualizado com sucesso" });
    });
});

// Deletar produto
app.delete('/DelProdutos/:id', (req, res) => {
    const { id } = req.params;

    db.query("DELETE FROM produto WHERE id_produto = ?", [id], (err, result) => {
        if (err) {
            return res.status(500).json({ erro: "Erro ao deletar produto" });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ mensagem: "Produto não encontrado" });
        }
        res.json({ mensagem: "Produto deletado com sucesso" });
    });
});





// ===============================
//  404 - Página não encontrada
// ===============================
app.use((req, res) => {
    res.status(404).send(`
        <h1>404 - Página não encontrada</h1>
        <a href="/">Voltar para Home</a>
    `);
});

// ===============================
// Inicializar servidor
// ===============================
app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando em: http://localhost:${PORT}`);
});
