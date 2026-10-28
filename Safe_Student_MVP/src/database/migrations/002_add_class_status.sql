-- Migration 002: Adiciona o atributo status à tabela classes
-- Permite controle de turmas ativas/inativas para novas matrículas
ALTER TABLE classes ADD COLUMN status TEXT NOT NULL DEFAULT 'ATIVO' CHECK (status IN ('ATIVO', 'INATIVO'));
