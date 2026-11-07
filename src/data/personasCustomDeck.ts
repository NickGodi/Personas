import type { MatchDeckCard } from '../types';

// Curated 18-card deck, including the card photos from the local creator deck.
export const PERSONAS_INITIAL_MATCH_DECK: MatchDeckCard[] = [
  {
    "id": "deck_1",
    "title": "Na minha época",
    "rule": "Jogar no Modo Clássico.",
    "description": "",
    "iconName": "Wine",
    "tags": [
      "Sustentação",
      "Early Game"
    ],
    "backgroundImage": "/card-images/personas-deck_1.webp"
  },
  {
    "id": "deck_2",
    "title": "ABCDraft",
    "rule": "Duas letras são sorteadas para cada capitão e eles devem montar comps, apenas com campeões que iniciem com essa letra.",
    "description": "",
    "iconName": "ArrowLeftRight",
    "tags": [
      "Rotação",
      "Capitães"
    ],
    "backgroundImage": "/card-images/personas-deck_2.webp"
  },
  {
    "id": "deck_3",
    "title": "Draft Chumbus",
    "rule": "O draft deve ser feito com todas as pessoas presentes na call.\nO jogador com menor elo ou menor média do time que deve fazer o Draft.",
    "description": "Obs: nada de trapacear, existe a aba denuncia no perfil da pessoa justamente para manter a personas divertida.",
    "iconName": "Swords",
    "tags": [
      "Abates",
      "Média"
    ],
    "backgroundImage": "/card-images/personas-deck_3.webp"
  },
  {
    "id": "deck_4",
    "title": "Modo Aleatório",
    "rule": "Leva a partida para o modo Todos Aleatório",
    "description": "",
    "iconName": "ZapOff",
    "tags": [
      "Feitiços",
      "Caos"
    ],
    "backgroundImage": "/card-images/personas-deck_4.webp"
  },
  {
    "id": "deck_5",
    "title": "Cãos",
    "rule": "Um jogador escolhido pelo capitão de cada time joga a partida inteira na call do adversário",
    "description": "Obs: Respeito acima de tudo galera, não é porque esta na call do inimigo que tem que fazer bagunça!!! nada de ofensas, barulhos esquisitos ou algo para deixar a call desagradável.\nPodendo levar ban sem aviso prévio.",
    "iconName": "Target",
    "tags": [
      "Jungle",
      "Objetivos"
    ],
    "backgroundImage": "/card-images/personas-deck_5.webp"
  },
  {
    "id": "deck_6",
    "title": "Telep",
    "rule": "Todos os jogadores são obrigados a pegar Teleporte.",
    "description": "",
    "iconName": "ShieldAlert",
    "tags": [
      "Itens",
      "Mindgame"
    ],
    "backgroundImage": "/card-images/personas-deck_6.webp"
  },
  {
    "id": "deck_7",
    "title": "Voz por Proximidade",
    "rule": "Jogadores se comunicam apenas com quem esta próximo, tanto aliados como adversários.",
    "description": "Obs: Aproximou, esta sendo ouvido.",
    "iconName": "Key",
    "tags": [
      "Criminoso",
      "Redenção"
    ],
    "backgroundImage": "/card-images/personas-deck_7.webp"
  },
  {
    "id": "deck_8",
    "title": "Draft Sabotado",
    "rule": "Escolha 3 picks que o adversário é obrigado a pegar.",
    "description": "Obs: Campeões da rota.",
    "iconName": "Compass",
    "tags": [
      "Invasão",
      "Jungle"
    ],
    "backgroundImage": "/card-images/personas-deck_8.webp"
  },
  {
    "id": "cblow_1",
    "title": "Draft Invertido",
    "rule": "A equipe inimiga escolhe os picks do adversário.",
    "description": "Os campeões tem que ser da mesma lane.",
    "iconName": "Shuffle",
    "tags": [
      "Sorteio",
      "CBLOW"
    ],
    "backgroundImage": "/card-images/personas-cblow_1.webp"
  },
  {
    "id": "cblow_2",
    "title": "Inimigo da Natureza",
    "rule": "Todos os jogadores devem usar Smite.",
    "description": "",
    "iconName": "History",
    "tags": [
      "Nostalgia",
      "CBLOW"
    ],
    "backgroundImage": "/card-images/personas-cblow_2.webp"
  },
  {
    "id": "cblow_3",
    "title": "Invasão de Yuumi",
    "rule": "Os capitães dos times são Obrigados a jogar de Yuumi.",
    "description": "",
    "iconName": "ListOrdered",
    "tags": [
      "Draft",
      "CBLOW"
    ],
    "backgroundImage": "/card-images/personas-cblow_3.webp"
  },
  {
    "id": "cblow_4",
    "title": "Modo Auto-Fill",
    "rule": "Todos os jogadores jogam fora da sua rota Principal.",
    "description": "",
    "iconName": "Crown",
    "tags": [
      "Estratégia",
      "CBLOW"
    ],
    "backgroundImage": "/card-images/personas-cblow_4.webp"
  },
  {
    "id": "cblow_5",
    "title": "Tudo Liberado",
    "rule": "Pode jogar de tudo, não tem banimento.",
    "description": "",
    "iconName": "Users",
    "tags": [
      "Draft",
      "CBLOW"
    ],
    "backgroundImage": "/card-images/personas-cblow_5.webp"
  },
  {
    "id": "cblow_6",
    "title": "Amigo da Natureza",
    "rule": "Vão jogar sem smite.",
    "description": "Especificamente, o jungler vai jogar sem smite.",
    "iconName": "Zap",
    "tags": [
      "Caos",
      "CBLOW"
    ],
    "backgroundImage": "/card-images/personas-cblow_6.webp"
  },
  {
    "id": "cblow_7",
    "title": "Inter Classe",
    "rule": "Um sorteio será feito, cada time só poderá pegar uma classe de campeão para jogar.",
    "description": "Exemplo: Suporte, atirador, tank, mago...",
    "iconName": "Brain",
    "tags": [
      "Estratégia",
      "CBLOW"
    ],
    "backgroundImage": "/card-images/personas-cblow_7.webp"
  },
  {
    "id": "cblow_8",
    "title": "Only English",
    "rule": "Todos os jogadores devem se comunicar em inglês",
    "description": "",
    "iconName": "AudioLines",
    "tags": [
      "Comunicação",
      "CBLOW"
    ],
    "backgroundImage": "/card-images/personas-cblow_8.webp"
  },
  {
    "id": "cblow_9",
    "title": "Velocidade 2x",
    "rule": "A partida acontece no 2x de velocidade.",
    "description": "",
    "iconName": "ShieldBan",
    "tags": [
      "Draft",
      "CBLOW"
    ],
    "backgroundImage": "/card-images/personas-cblow_9.webp"
  },
  {
    "id": "cblow_10",
    "title": "Inversão de rotas",
    "rule": "os capitães escolhem quais lanes vão ser trocadas.",
    "description": "Ex: Mid com top.",
    "iconName": "ArrowDownWideNarrow",
    "tags": [
      "Draft",
      "CBLOW"
    ],
    "backgroundImage": "/card-images/personas-cblow_10.webp"
  }
];
