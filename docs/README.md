# 📚 Documentação do Projeto Legado - Cícero Joias

## 📖 Documentação Ativa

### Arquitetura e Design
- **[LEGADO_atendimento.md](./LEGADO_atendimento.md)** - Documento de atendimento e regras de negócio
- **[LEGADO_soul.md](./LEGADO_soul.md)** - Alma e princípios do projeto
- **[LEGADO_roadmap.md](./LEGADO_roadmap.md)** - Roadmap e direções futuras

### Decisões de Arquitetura (ADR)
- **[0001-soft-delete-lancamentos.md](./adr/0001-soft-delete-lancamentos.md)** - Soft delete em lançamentos
- **[0002-trava-24h-sem-override-super-admin.md](./adr/0002-trava-24h-sem-override-super-admin.md)** - Trava de edição de 24h

### Configurações e guias
- **[orcamento-presets.md](./orcamento-presets.md)** - Presets para orçamentos
- **[whatsapp-template-setup-guide.md](./whatsapp-template-setup-guide.md)** - Como criar e aprovar modelos de mensagem na Meta (fora da janela de 24 h)
- **[notificacoes-guia.md](./notificacoes-guia.md)** - Notificações push: configuração e testes
- **[notificacoes-push-diagnostico.md](./notificacoes-push-diagnostico.md)** - Notificações push: diagnóstico de problemas
- **[github-actions-cron-setup.md](./github-actions-cron-setup.md)** - Resumo financeiro diário via GitHub Actions (passo a passo)
- **[CHECKLIST-CRON.md](./CHECKLIST-CRON.md)** - Versão rápida (5 min) do guia acima

### Melhorias, análises e otimização
- **[melhorias.md](./melhorias.md)** - Registro de melhorias implementadas
- **[LEGADO_analise_abr2026.md](./LEGADO_analise_abr2026.md)** - Auditoria estratégica de abril/2026 (v0.18.39)
- **[PLANO-OTIMIZACAO.md](./PLANO-OTIMIZACAO.md)** - Otimização de outubro/2026 (v0.18.85 → v0.18.91): velocidade, segurança, organização, com antes/depois

## 🗄️ Documentação Arquivada

Documentos históricos e de implementação que foram movidos para referência futura:

### Brainstorms e Planejamentos
- `BRAINSTORM_modulo4_whatsapp_ia.md` - Brainstorm módulo WhatsApp IA
- `BRAINSTORM_modulo_whatsapp_inbox.md` - Brainstorm módulo WhatsApp Inbox

### Implementações
- `PHASE_1_IMPLEMENTATION_SUMMARY.md` - Resumo implementação Fase 1
- `PHASE_2_IMPLEMENTATION_SUMMARY.md` - Resumo implementação Fase 2
- `MENU_AUTOMATICO_IMPLEMENTACAO.md` - Implementação menu automático
- `MENU_AUTOMATICO_GUIA_RAPIDO.md` - Guia rápido do menu automático

### Diagnósticos e Correções
- `DIAGNOSTICO_REALTIME_WAB.md` - Diagnóstico realtime WAB
- `CORRECAO_STATUS_LEITURA_WHATSAPP.md` - Correção status leitura
- `REALTIME_QUICK_START.md` - Quick start realtime

### Relatórios
- `WHATSAPP_OPTIMIZATION_REPORT.md` - Relatório de otimização WhatsApp
- `LIMPEZA_OTIMIZACAO_RESUMO.md` - Limpeza do projeto de fevereiro/2025 (v0.18.18)

### Testes
- `LEGADO_flowchart_testes.md` - Fluxograma de testes

> **Nota:** Estes documentos estão arquivados para referência histórica. Para documentação atual, consulte os arquivos na raiz da pasta `docs/`.

## 📋 Changelog

O changelog completo e unificado do projeto está localizado na raiz do repositório:
- **[CHANGELOG.md](../CHANGELOG.md)** - Histórico completo de todas as versões (unificado em Fevereiro 2026). Fica só no computador (está no `.gitignore`), por isso não aparece no GitHub.
- A fonte oficial de cada versão é o `CHANGELOG_RESUMIDO` em `src/app/(protected)/perfil/page.tsx` (a tela Perfil mostra as 3 últimas).
