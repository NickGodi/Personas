import { User, MatchDeckCard, Team, CardItem, DraftPreset, EloTier } from '../types';

// High quality stylized test esports avatars (replacing user personal photos)
const TEST_AVATARS = {
  samurai: '/src/assets/images/esport_avatar_cyber_samurai_1793731357020.jpg',
  duck: '/src/assets/images/personas_duck_mascot_1793729518059.jpg',
  ninja: 'https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=300&auto=format&fit=crop&q=80',
  tactical: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80',
  sniper: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80',
  mage: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=300&auto=format&fit=crop&q=80',
  valkyrie: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=300&auto=format&fit=crop&q=80',
  shadow: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=300&auto=format&fit=crop&q=80',
  berserker: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&auto=format&fit=crop&q=80',
  support: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=300&auto=format&fit=crop&q=80',
  brawler: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=300&auto=format&fit=crop&q=80',
  woodman: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=300&auto=format&fit=crop&q=80',
  prisoner: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=300&auto=format&fit=crop&q=80',
};

// 13 Initial Users covering every single rank & role with registration dates
export const INITIAL_USERS: User[] = [
  {
    id: 'user_derick',
    handle: '@derick',
    name: 'Derick (Lenda Viva)',
    role: 'jogador',
    isOnline: false,
    avatar: TEST_AVATARS.samurai,
    bio: 'Tricampeão supremo e Lenda eterna da comunidade.',
    favoriteChampion: 'Kayle',
    primaryLane: 'TOP',
    riotId: 'Derick#BR1',
    currentScore: 99,
    totalVotes: 0,
    seasonsPlayed: 0,
    mvpCount: 8,
    aceCount: 1,
    isLegend: true,
    entryDate: '10/01/2024',
    createdAt: '2024-01-10T12:00:00Z',
    stats: { kills: 14, deaths: 2, assists: 9, minions: 0, gold: 0 },
    comments: []
  },
  {
    id: 'user_nicolas',
    handle: '@nick',
    name: 'Nicolas Like',
    role: 'criador',
    isOnline: false,
    avatar: TEST_AVATARS.ninja,
    bio: 'Criador e Administrador Supremo do Personas. Monitorando partidas e balanceamentos.',
    favoriteChampion: 'Aatrox',
    primaryLane: 'TOP',
    riotId: 'Nicolas#BR1',
    currentScore: 97,
    totalVotes: 0,
    seasonsPlayed: 0,
    mvpCount: 7,
    aceCount: 0,
    entryDate: '01/01/2024',
    createdAt: '2024-01-01T00:00:00Z',
    stats: { kills: 19, deaths: 9, assists: 5, minions: 330, gold: 23941 },
    comments: []
  },
  {
    id: 'user_maycao',
    handle: '@maycao',
    name: 'Maycão Chave',
    role: 'jogador',
    isOnline: false,
    avatar: TEST_AVATARS.shadow,
    bio: 'Assassino implacável no Mid e Grão-Mestre em teamfights.',
    favoriteChampion: 'Zed',
    primaryLane: 'MID',
    riotId: 'Maycao#BR1',
    currentScore: 95,
    totalVotes: 0,
    seasonsPlayed: 0,
    mvpCount: 5,
    aceCount: 2,
    entryDate: '15/01/2024',
    createdAt: '2024-01-15T10:00:00Z',
    stats: { kills: 12, deaths: 4, assists: 7, minions: 0, gold: 0 },
    comments: []
  },
  {
    id: 'user_vexy',
    handle: '@vexy',
    name: 'Vexy Void',
    role: 'jogador',
    isOnline: false,
    avatar: TEST_AVATARS.mage,
    bio: 'Mestre do controle de grupo. Sempre acertando as ultimates decisivas.',
    favoriteChampion: 'Syndra',
    primaryLane: 'MID',
    riotId: 'Vexy#BR1',
    currentScore: 91,
    totalVotes: 0,
    seasonsPlayed: 0,
    mvpCount: 4,
    aceCount: 2,
    entryDate: '22/01/2024',
    createdAt: '2024-01-22T14:00:00Z',
    stats: { kills: 9, deaths: 3, assists: 11, minions: 0, gold: 0 },
    comments: []
  },
  {
    id: 'user_raven',
    handle: '@raven',
    name: 'Raven Diamante',
    role: 'jogador',
    isOnline: false,
    avatar: TEST_AVATARS.sniper,
    bio: 'Atirador de alta precisão. Citing perfeito e dano constante nos confrontos.',
    favoriteChampion: 'Jhin',
    primaryLane: 'ADC',
    riotId: 'Raven#BR1',
    currentScore: 87,
    totalVotes: 0,
    seasonsPlayed: 0,
    mvpCount: 3,
    aceCount: 3,
    entryDate: '02/02/2024',
    createdAt: '2024-02-02T16:00:00Z',
    stats: { kills: 10, deaths: 4, assists: 6, minions: 0, gold: 0 },
    comments: []
  },
  {
    id: 'user_celesta',
    handle: '@celesta',
    name: 'Celesta',
    role: 'jogador',
    isOnline: false,
    avatar: TEST_AVATARS.valkyrie,
    bio: 'Suporte encantadora e jogadora de utilidade máxima. Visão de mapa impecável.',
    favoriteChampion: 'Lulu',
    primaryLane: 'SUPORTE',
    riotId: 'Celesta#BR1',
    currentScore: 82,
    totalVotes: 0,
    seasonsPlayed: 0,
    mvpCount: 2,
    aceCount: 3,
    entryDate: '10/02/2024',
    createdAt: '2024-02-10T19:00:00Z',
    stats: { kills: 3, deaths: 4, assists: 19, minions: 0, gold: 0 },
    comments: []
  },
  {
    id: 'user_kairos',
    handle: '@kairos',
    name: 'Kairos Platina',
    role: 'jogador',
    isOnline: false,
    avatar: TEST_AVATARS.tactical,
    bio: 'Caçador agressivo. Ganks nível 3 frequentes e controle de arauto.',
    favoriteChampion: 'Jarvan IV',
    primaryLane: 'JUNGLE',
    riotId: 'Kairos#BR1',
    currentScore: 77,
    totalVotes: 0,
    seasonsPlayed: 0,
    mvpCount: 2,
    aceCount: 1,
    entryDate: '18/02/2024',
    createdAt: '2024-02-18T20:30:00Z',
    stats: { kills: 6, deaths: 5, assists: 12, minions: 0, gold: 0 },
    comments: []
  },
  {
    id: 'user_reis',
    handle: '@reis',
    name: 'Reis Rústico',
    role: 'jogador',
    isOnline: false,
    avatar: TEST_AVATARS.berserker,
    bio: 'Estilo rústico, jogabilidade raiz. Sem medo de ir pra cima na lane com Darius.',
    favoriteChampion: 'Darius',
    primaryLane: 'TOP',
    riotId: 'Reis#BR1',
    currentScore: 72,
    totalVotes: 0,
    seasonsPlayed: 0,
    mvpCount: 1,
    aceCount: 2,
    entryDate: '25/02/2024',
    createdAt: '2024-02-25T11:00:00Z',
    stats: { kills: 7, deaths: 6, assists: 5, minions: 0, gold: 0 },
    comments: []
  },
  {
    id: 'user_raiq',
    handle: '@raiq',
    name: 'RAIQ CABS',
    role: 'jogador',
    isOnline: false,
    avatar: TEST_AVATARS.brawler,
    bio: 'Campeão consolidado e mestre da resenha da comunidade.',
    favoriteChampion: 'Lee Sin',
    primaryLane: 'JUNGLE',
    riotId: 'Raiq#BR1',
    currentScore: 67,
    totalVotes: 0,
    seasonsPlayed: 0,
    mvpCount: 3,
    aceCount: 2,
    isMencaoHonrosa: true,
    entryDate: '12/01/2024',
    createdAt: '2024-01-12T15:00:00Z',
    stats: { kills: 6, deaths: 6, assists: 10, minions: 0, gold: 0 },
    comments: []
  },
  {
    id: 'user_yago',
    handle: '@yago',
    name: 'Yago Bronze',
    role: 'jogador',
    isOnline: false,
    avatar: TEST_AVATARS.support,
    bio: 'Tentando aprender a wardar direito. Um dia chego no Ouro!',
    favoriteChampion: 'Blitzcrank',
    primaryLane: 'SUPORTE',
    riotId: 'Yago#BR1',
    currentScore: 62,
    totalVotes: 0,
    seasonsPlayed: 0,
    mvpCount: 0,
    aceCount: 2,
    entryDate: '01/03/2024',
    createdAt: '2024-03-01T12:00:00Z',
    stats: { kills: 2, deaths: 7, assists: 8, minions: 0, gold: 0 },
    comments: []
  },
  {
    id: 'user_brutus',
    handle: '@brutus',
    name: 'Brutus Ferro',
    role: 'jogador',
    isOnline: false,
    avatar: TEST_AVATARS.woodman,
    bio: 'Jogando com a tela bloqueada e build exótica. Pura diversão no ferro.',
    favoriteChampion: 'Garen',
    primaryLane: 'TOP',
    riotId: 'Brutus#BR1',
    currentScore: 54,
    totalVotes: 0,
    seasonsPlayed: 0,
    mvpCount: 0,
    aceCount: 1,
    entryDate: '15/03/2024',
    createdAt: '2024-03-15T18:00:00Z',
    stats: { kills: 0, deaths: 0, assists: 0, minions: 0, gold: 0 },
    comments: []
  },
  {
    id: 'user_teco',
    handle: '@teco',
    name: 'Teco Madeira',
    role: 'jogador',
    isOnline: false,
    avatar: TEST_AVATARS.woodman,
    bio: 'Elo Madeira certificado. Esquece de apertar o Smite e erra todos os flashes.',
    favoriteChampion: 'Malphite',
    primaryLane: 'TOP',
    riotId: 'Teco#BR1',
    currentScore: 45,
    totalVotes: 0,
    seasonsPlayed: 0,
    mvpCount: 0,
    aceCount: 1,
    entryDate: '28/03/2024',
    createdAt: '2024-03-28T21:00:00Z',
    stats: { kills: 1, deaths: 10, assists: 5, minions: 0, gold: 0 },
    comments: []
  },
  {
    id: 'user_nick',
    handle: '@nickpresidiario',
    name: 'Nick Presidiário',
    role: 'jogador',
    isOnline: false,
    avatar: TEST_AVATARS.prisoner,
    bio: 'O terror do presídio Personas. Menor média da história e preso na cela!',
    favoriteChampion: 'Kassadin',
    primaryLane: 'MID',
    riotId: 'NickPresidiario#BR1',
    currentScore: 35,
    totalVotes: 0,
    seasonsPlayed: 0,
    mvpCount: 0,
    aceCount: 4,
    isCriminoso: false,
    entryDate: '05/01/2024',
    createdAt: '2024-01-05T19:00:00Z',
    stats: { kills: 2, deaths: 12, assists: 3, minions: 0, gold: 0 },
    comments: []
  }
];

// 13 Exemplos de Cartas do Maior para o Menor
export const INITIAL_CARDS: CardItem[] = [
  // 1. Challenger (Derick) — Cartas Lenda só são liberadas após três temporadas concluídas.
  {
    id: 'card_1_challenger',
    userId: 'user_derick',
    userName: 'Derick',
    userHandle: '@derick',
    userAvatar: TEST_AVATARS.samurai,
    season: 1,
    score: 99,
    tier: 'challenger',
    lane: 'TOP',
    favoriteChampion: 'Kayle',
    isMvp: false,
    isAce: false,
    isCriminoso: false,
    isLegend: false,
    stats: { kills: 14, deaths: 2, assists: 9, minions: 0, gold: 0 },
    date: 'Hoje'
  },
  // 2. Challenger (Nicolas)
  {
    id: 'card_2_challenger',
    userId: 'user_nicolas',
    userName: 'Nicolas',
    userHandle: '@nicolas',
    userAvatar: TEST_AVATARS.ninja,
    season: 1,
    score: 97,
    tier: 'challenger',
    lane: 'TOP',
    favoriteChampion: 'Aatrox',
    isMvp: false,
    isAce: false,
    isCriminoso: false,
    isLegend: false,
    stats: { kills: 19, deaths: 9, assists: 5, minions: 330, gold: 23941 },
    date: 'Hoje'
  },
  // 3. Grão Mestre (Maycão)
  {
    id: 'card_3_grao_mestre',
    userId: 'user_maycao',
    userName: 'Maycão Chave',
    userHandle: '@maycao',
    userAvatar: TEST_AVATARS.shadow,
    season: 1,
    score: 95,
    tier: 'grao_mestre',
    lane: 'MID',
    favoriteChampion: 'Zed',
    isMvp: false,
    isAce: true,
    isCriminoso: false,
    isLegend: false,
    stats: { kills: 12, deaths: 4, assists: 7, minions: 0, gold: 0 },
    date: 'Ontem'
  },
  // 4. Mestre (Vexy)
  {
    id: 'card_4_mestre',
    userId: 'user_vexy',
    userName: 'Vexy Void',
    userHandle: '@vexy',
    userAvatar: TEST_AVATARS.mage,
    season: 1,
    score: 91,
    tier: 'mestre',
    lane: 'MID',
    favoriteChampion: 'Syndra',
    isMvp: false,
    isAce: false,
    isCriminoso: false,
    isLegend: false,
    stats: { kills: 9, deaths: 3, assists: 11, minions: 0, gold: 0 },
    date: 'Ontem'
  },
  // 5. Diamante (Raven)
  {
    id: 'card_5_diamante',
    userId: 'user_raven',
    userName: 'Raven',
    userHandle: '@raven',
    userAvatar: TEST_AVATARS.sniper,
    season: 1,
    score: 87,
    tier: 'diamante',
    lane: 'ADC',
    favoriteChampion: 'Jhin',
    isMvp: false,
    isAce: false,
    isCriminoso: false,
    isLegend: false,
    stats: { kills: 10, deaths: 4, assists: 6, minions: 0, gold: 0 },
    date: '2 dias atrás'
  },
  // 6. Esmeralda (Celesta)
  {
    id: 'card_6_esmeralda',
    userId: 'user_celesta',
    userName: 'Celesta',
    userHandle: '@celesta',
    userAvatar: TEST_AVATARS.valkyrie,
    season: 1,
    score: 82,
    tier: 'esmeralda',
    lane: 'SUPORTE',
    favoriteChampion: 'Lulu',
    isMvp: false,
    isAce: false,
    isCriminoso: false,
    isLegend: false,
    stats: { kills: 3, deaths: 4, assists: 19, minions: 0, gold: 0 },
    date: '3 dias atrás'
  },
  // 7. Platina (Kairos)
  {
    id: 'card_7_platina',
    userId: 'user_kairos',
    userName: 'Kairos',
    userHandle: '@kairos',
    userAvatar: TEST_AVATARS.tactical,
    season: 1,
    score: 77,
    tier: 'platina',
    lane: 'JUNGLE',
    favoriteChampion: 'Jarvan IV',
    isMvp: false,
    isAce: false,
    isCriminoso: false,
    isLegend: false,
    stats: { kills: 6, deaths: 5, assists: 12, minions: 0, gold: 0 },
    date: '4 dias atrás'
  },
  // 8. Ouro (Reis)
  {
    id: 'card_8_ouro',
    userId: 'user_reis',
    userName: 'Reis Rústico',
    userHandle: '@reis',
    userAvatar: TEST_AVATARS.berserker,
    season: 1,
    score: 72,
    tier: 'ouro',
    lane: 'TOP',
    favoriteChampion: 'Darius',
    isMvp: false,
    isAce: false,
    isCriminoso: false,
    isLegend: false,
    stats: { kills: 7, deaths: 6, assists: 5, minions: 0, gold: 0 },
    date: '5 dias atrás'
  },
  // 9. Prata (RAIQ)
  {
    id: 'card_9_prata',
    userId: 'user_raiq',
    userName: 'RAIQ CABS',
    userHandle: '@raiq',
    userAvatar: TEST_AVATARS.brawler,
    season: 1,
    score: 67,
    tier: 'prata',
    lane: 'JUNGLE',
    favoriteChampion: 'Lee Sin',
    isMvp: false,
    isAce: false,
    isCriminoso: false,
    isLegend: false,
    isMencaoHonrosa: true,
    stats: { kills: 6, deaths: 6, assists: 10, minions: 0, gold: 0 },
    date: '1 semana atrás'
  },
  // 10. Bronze (Yago)
  {
    id: 'card_10_bronze',
    userId: 'user_yago',
    userName: 'Yago',
    userHandle: '@yago',
    userAvatar: TEST_AVATARS.support,
    season: 1,
    score: 62,
    tier: 'bronze',
    lane: 'SUPORTE',
    favoriteChampion: 'Blitzcrank',
    isMvp: false,
    isAce: false,
    isCriminoso: false,
    isLegend: false,
    stats: { kills: 2, deaths: 7, assists: 8, minions: 0, gold: 0 },
    date: '1 semana atrás'
  },
  // 11. Ferro (Brutus)
  {
    id: 'card_11_ferro',
    userId: 'user_brutus',
    userName: 'Brutus',
    userHandle: '@brutus',
    userAvatar: TEST_AVATARS.woodman,
    season: 1,
    score: 54,
    tier: 'ferro',
    lane: 'TOP',
    favoriteChampion: 'Garen',
    isMvp: false,
    isAce: false,
    isCriminoso: false,
    isLegend: false,
    stats: { kills: 0, deaths: 0, assists: 0, minions: 0, gold: 0 },
    date: '2 semanas atrás'
  },
  // 12. Madeira (Teco - Novo Elo!)
  {
    id: 'card_12_madeira',
    userId: 'user_teco',
    userName: 'Teco',
    userHandle: '@teco',
    userAvatar: TEST_AVATARS.woodman,
    season: 1,
    score: 45,
    tier: 'madeira',
    lane: 'TOP',
    favoriteChampion: 'Malphite',
    isMvp: false,
    isAce: false,
    isCriminoso: false,
    isLegend: false,
    stats: { kills: 1, deaths: 10, assists: 5, minions: 0, gold: 0 },
    date: '2 semanas atrás'
  },
  // 13. Criminoso (Nick - Atrás das Grades)
  {
    id: 'card_13_criminoso',
    userId: 'user_nick',
    userName: 'Nick Presidiário',
    userHandle: '@nick',
    userAvatar: TEST_AVATARS.prisoner,
    season: 1,
    score: 35,
    tier: 'madeira',
    lane: 'MID',
    favoriteChampion: 'Kassadin',
    isMvp: false,
    isAce: false,
    isCriminoso: false,
    isLegend: false,
    stats: { kills: 2, deaths: 12, assists: 3, minions: 0, gold: 0 },
    date: 'Condenação ativa'
  }
];

export const INITIAL_MATCH_DECK: MatchDeckCard[] = [
  {
    id: 'deck_1',
    title: 'Lei Seca no Rift',
    rule: 'Nenhum jogador pode comprar poções de vida ou refil nos primeiros 10 minutos de partida.',
    description: 'A sustentação será puramente natural ou por feitiços de cura. Errou na troca, volta base!',
    iconName: 'Wine',
    tags: ['Sustentação', 'Early Game']
  },
  {
    id: 'deck_2',
    title: 'Inversão dos Presidentes',
    rule: 'O Toplaner e o Midlaner devem trocar de rotas obrigatoriamente até a primeira torre cair.',
    description: 'Os comandantes se enfrentam em territórios trocados testando adaptação tática.',
    iconName: 'ArrowLeftRight',
    tags: ['Rotação', 'Capitães']
  },
  {
    id: 'deck_3',
    title: 'Modo Gladiador (First Blood VIP)',
    rule: 'O jogador que conquistar o First Blood ganha automaticamente +5 pontos de bônus na média da rodada.',
    description: 'Tudo ou nada no nível 1. A agressão é recompensada imediatamente na votação.',
    iconName: 'Swords',
    tags: ['Abates', 'Média']
  },
  {
    id: 'deck_4',
    title: 'Flash Proibido',
    rule: 'É proibido selecionar o feitiço Flash. Substituição obrigatória por Fantasma ou Barreira.',
    description: 'Sem botão de pânico! Posicionamento rigoroso e punições severas para quem se isolar.',
    iconName: 'ZapOff',
    tags: ['Feitiços', 'Caos']
  },
  {
    id: 'deck_5',
    title: 'Duelo dos Caçadores',
    rule: 'Golpear (Smite) é estritamente proibido em monstros comuns, liberado apenas em Dragão e Barão.',
    description: 'A limpeza da selva será no braço e o controle dos objetivos neutros vira pura guerra mental.',
    iconName: 'Target',
    tags: ['Jungle', 'Objetivos']
  },
  {
    id: 'deck_6',
    title: 'Veto do Capitão',
    rule: 'Cada capitão escolhe 1 item lendário para banir do capitão rival antes de iniciar a partida.',
    description: 'Anule a build perfeita do capitão adversário e force adaptações inusitadas.',
    iconName: 'ShieldAlert',
    tags: ['Itens', 'Mindgame']
  },
  {
    id: 'deck_7',
    title: 'O Retorno do Criminoso',
    rule: 'O jogador classificado como Criminoso recebe prioridade total de farm no arauto e na primeira barricada.',
    description: 'Uma chance de redenção para sair da prisão com honra diante dos companheiros!',
    iconName: 'Key',
    tags: ['Criminoso', 'Redenção']
  },
  {
    id: 'deck_8',
    title: 'Roleta da Selva Invertida',
    rule: 'Os dois junglers são obrigados a começar a partida invadindo o buff vermelho do adversário.',
    description: 'Caos no level 1! Invasão mútua garantida e emboscadas imprevistas no rio.',
    iconName: 'Compass',
    tags: ['Invasão', 'Jungle']
  },
  ...[
    ['Todos Aleatório', 'Todas as escolhas da partida são sorteadas entre as opções válidas.', 'A sorte define a composição e o plano de jogo.', 'Shuffle', ['Sorteio', 'CBLOW']],
    ['A Mesma de Outra Época', 'Repita uma regra ou composição usada em uma partida anterior.', 'Uma volta ao meta de outra época da comunidade.', 'History', ['Nostalgia', 'CBLOW']],
    ['ABCDraft', 'A ordem de escolha segue as letras do alfabeto; cada capitão escolhe uma opção por vez.', 'Organize o draft em ordem alfabética.', 'ListOrdered', ['Draft', 'CBLOW']],
    ['Coach Presidencial', 'Cada equipe escolhe um coach para orientar as decisões antes do início.', 'O coach ajuda a definir estratégia e escolhas do time.', 'Crown', ['Estratégia', 'CBLOW']],
    ['Draft Chumbus', 'Os capitães alternam as escolhas dos jogadores disponíveis.', 'Monte os times em um draft alternado.', 'Users', ['Draft', 'CBLOW']],
    ['Modo Caos', 'O criador sorteia uma regra extra para a partida.', 'Uma condição inesperada muda o plano de jogo.', 'Zap', ['Caos', 'CBLOW']],
    ['Modo Telep', 'Cada equipe combina sua estratégia antes da partida e evita revelar o plano ao adversário.', 'Coordenação e leitura do mapa em primeiro plano.', 'Brain', ['Estratégia', 'CBLOW']],
    ['Voz por Proximidade', 'A comunicação de voz fica limitada aos jogadores próximos no jogo.', 'Informações dependem da posição de cada jogador.', 'AudioLines', ['Comunicação', 'CBLOW']],
    ['Draft Sabotado', 'Antes do draft, cada capitão bloqueia uma escolha do time adversário.', 'Adapte a composição às escolhas vetadas.', 'ShieldBan', ['Draft', 'CBLOW']],
    ['Draft Invertido', 'A ordem das escolhas começa pelo último capitão sorteado.', 'O segundo lado abre o draft e define o ritmo.', 'ArrowDownWideNarrow', ['Draft', 'CBLOW']],
    ['Inimigo da Natureza', 'O time define uma restrição especial para objetivos neutros antes da partida.', 'A disputa por objetivos muda a rota pelo mapa.', 'TreePine', ['Objetivos', 'CBLOW']],
    ['Invasão de Yuumi', 'Cada equipe deve incluir Yuumi na composição quando o campeão estiver disponível.', 'A estratégia gira em torno da campeã e de quem ela acompanha.', 'Cat', ['Campeões', 'CBLOW']],
    ['Modo Auto-Fill', 'As rotas são sorteadas entre os participantes antes de começar.', 'Flexibilidade para jogar fora da rota principal.', 'Shuffle', ['Rotas', 'CBLOW']],
    ['Tudo Liberado', 'Não há restrições extras de campeões, feitiços ou itens nesta partida.', 'Jogue com as escolhas normalmente disponíveis.', 'Unlock', ['Livre', 'CBLOW']],
    ['Amigos da Natureza', 'As equipes priorizam objetivos da selva e coordenam a disputa pelo rio.', 'Dragões, Arauto e Barão entram no centro da estratégia.', 'Trees', ['Objetivos', 'CBLOW']],
    ['Inter Classe', 'Cada equipe monta uma composição com classes variadas, evitando repetir o mesmo estilo.', 'Diversifique a composição para cobrir mais funções.', 'Layers', ['Composição', 'CBLOW']],
    ['Only English', 'A comunicação de equipe durante a partida deve ser em inglês.', 'Um desafio de comunicação para o elenco.', 'Languages', ['Comunicação', 'CBLOW']],
    ['Velocidade Ajustada', 'O criador escolhe um ritmo de jogo e uma condição de tempo antes da partida.', 'Partida com ritmo e objetivos definidos pela organização.', 'Gauge', ['Ritmo', 'CBLOW']],
    ['Era das Máquinas', 'Cada equipe deve incluir pelo menos um campeão de temática mecânica ou tecnológica.', 'Monte uma composição com campeões de máquinas e tecnologia.', 'Cog', ['Campeões', 'CBLOW']],
    ['Inversão de Rotas', 'Os jogadores trocam as rotas principais no início da partida.', 'Adaptação e comunicação para jogar fora da zona de conforto.', 'ArrowLeftRight', ['Rotas', 'CBLOW']],
  ].map(([title, rule, description, iconName, tags], index) => ({
    id: `cblow_${index + 1}`,
    title: title as string,
    rule: rule as string,
    description: description as string,
    iconName: iconName as string,
    tags: tags as string[],
  }))
];

export const INITIAL_TEAMS: Team[] = [
  {
    id: 'team_tav',
    name: 'TAV Esports',
    tag: 'TAV',
    captainId: 'user_derick',
    captainName: 'Derick (Lenda Viva)',
    description: 'Equipe focada no jogo rápido e agressão máxima nas rotas laterais. Liderada por Derick.',
    logo: '⚔️',
    members: ['user_derick', 'user_maycao', 'user_celesta', 'user_vexy'],
    seriesFormat: 'MD3',
    side: 'azul',
    stats: {
      matches: 14,
      wins: 11,
      losses: 3
    }
  },
  {
    id: 'team_cabs',
    name: 'CABS Legends',
    tag: 'CABS',
    captainId: 'user_raiq',
    captainName: 'RAIQ CABS',
    description: 'Equipe tradicional da comunidade. Foco no controle da selva e teamfights de fim de jogo.',
    logo: '🏆',
    members: ['user_raiq', 'user_reis', 'user_kairos', 'user_raven'],
    seriesFormat: 'MD3',
    side: 'vermelho',
    stats: {
      matches: 14,
      wins: 9,
      losses: 5
    }
  }
];

export const INITIAL_PRESETS: DraftPreset[] = [
  {
    id: 'preset_semanal',
    name: 'Torneio Clássico Personas (TAV vs CABS)',
    captainIds: ['user_derick', 'user_raiq'],
    poolPlayerIds: [
      'user_derick',
      'user_raiq',
      'user_maycao',
      'user_celesta',
      'user_vexy',
      'user_raven',
      'user_kairos',
      'user_reis'
    ],
    createdAt: '2024-08-20T19:00:00Z'
  },
  {
    id: 'preset_veteranos',
    name: 'Confronto dos Veteranos',
    captainIds: ['user_nicolas', 'user_derick'],
    poolPlayerIds: ['user_nicolas', 'user_derick', 'user_maycao', 'user_raiq', 'user_vexy'],
    createdAt: '2024-08-22T21:30:00Z'
  }
];

export function getTierFromScore(score: number, isCriminoso = false): EloTier {
  if (isCriminoso) return 'criminoso';
  if (score >= 98) return 'lenda';
  if (score >= 90) return 'challenger';
  if (score >= 82) return 'grao_mestre';
  if (score >= 75) return 'mestre';
  if (score >= 69) return 'diamante';
  if (score >= 60) return 'esmeralda';
  if (score >= 53) return 'platina';
  if (score >= 47) return 'ouro';
  if (score >= 40) return 'prata';
  if (score >= 30) return 'bronze';
  if (score >= 25) return 'ferro';
  if (score >= 15) return 'madeira';
  return 'criminoso';
}

export const PERSONAS_RULES = {
  title: 'Regulamento Oficial Personas',
  version: 'Edição Definitiva',
  sections: [
    {
      title: '1. O Sistema dos Presidentes e Capitães',
      items: [
        'Cada time é encabeçado por um Capitão (Presidente) com plenos poderes para adicionar, dispensar membros para os Agentes Livres e editar o nome e a tática da equipe.',
        'O capitão tem direito a escolher seus titulares nos drafts oficiais e definir o formato do confronto (MD1, MD3 ou MD5).',
        'Capitães possuem o direito de solicitar um novo giro de carta antes do início da partida. Se o capitão adversário der o aceite, a carta gira novamente com efeito imediato.',
        'Jogadores não alocados permanecem como Agentes Livres (Free Agents) disponíveis no mercado para convocação.'
      ]
    },
    {
      title: '2. As Cartas de Sorteio Pré-Partida',
      items: [
        'Antes de qualquer confronto decisivo, uma carta da Roleta de Efeitos do Personas deve ser sorteada publicamente.',
        'As regras descritas na carta sorteada passam a valer com peso regulamentar no Rift.',
        'Caso haja infração da regra da carta sorteada, a comissão moderadora pode penalizar o jogador com nota decrescente na votação posterior.'
      ]
    },
    {
      title: '3. A Escala dos Elos (Do Maior ao Menor)',
      items: [
        'Lenda (98+): Reservada aos maiores campeões da história do Personas; é desbloqueada após três temporadas concluídas.',
        'Challenger (90 - 97) | Grão-Mestre (82 - 89) | Mestre (75 - 81) | Diamante (69 - 74) | Esmeralda (60 - 68).',
        'Platina (53 - 59) | Ouro (47 - 52) | Prata (40 - 46) | Bronze (30 - 39) | Ferro (25 - 29).',
        'Madeira (15 - 24): Jogadores em fase de aprendizado com borda rústica de carvalho.',
        'Criminoso (0 - 14): Um por temporada. Ao encerrar a temporada, o jogador com a menor média recebe o título; em caso de empate, as estatísticas da temporada definem o resultado.'
      ]
    },
    {
      title: '4. Sistema de Votação, Comentários & Médias',
      items: [
        'Ao término de cada confronto, qualquer jogador pode clicar no perfil do atleta para atribuir notas de 0 a 100 e deixar um comentário no chat individual do jogador.',
        'A média aritmética determina a classificação, elo da temporada e honrarias individuais.',
        'O jogador de maior destaque no time vencedor é condecorado como MVP, e o do time perdedor condecorado como ACE.'
      ]
    },
    {
      title: '5. Ética, Conduta e Sistema de Denúncias',
      items: [
        'Qualquer conduta antidesportiva, rage quit ou manipulação de votos pode ser denunciada diretamente no botão de Denúncia.',
        'Todas as denúncias são encaminhadas instantaneamente para o Painel do Criador (@nicolas) para auditoria e deliberação.'
      ]
    }
  ]
};
