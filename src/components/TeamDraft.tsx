import React, { useMemo, useState } from 'react';
import { User, Team, DraftPreset, EloTier, Lane, MatchSeriesFormat, SharedTournamentState, TeamDraftMode, VoteRecord } from '../types';
import { getTierFromScore } from '../data/initialData';
import { displayLogin } from '../utils/userIdentity';
import { rouletteSound } from '../utils/audio';
import { 
  Users, 
  Shuffle, 
  Crown, 
  Save, 
  Plus, 
  Trash2, 
  UserMinus, 
  Trophy, 
  Search,
  GripVertical,
} from 'lucide-react';

const TEAM_MEMBER_LIMIT = 5;

const tierOptions: { value: EloTier; label: string }[] = [
  { value: 'lenda', label: 'Lenda' },
  { value: 'challenger', label: 'Challenger' },
  { value: 'grao_mestre', label: 'Grão-Mestre' },
  { value: 'mestre', label: 'Mestre' },
  { value: 'diamante', label: 'Diamante' },
  { value: 'esmeralda', label: 'Esmeralda' },
  { value: 'platina', label: 'Platina' },
  { value: 'ouro', label: 'Ouro' },
  { value: 'prata', label: 'Prata' },
  { value: 'bronze', label: 'Bronze' },
  { value: 'ferro', label: 'Ferro' },
  { value: 'madeira', label: 'Madeira' },
  { value: 'criminoso', label: 'Criminoso' },
  { value: 'mencao_honrosa', label: 'Menção honrosa' },
];

interface TeamDraftProps {
  users: User[];
  votes: VoteRecord[];
  teams: Team[];
  presets: DraftPreset[];
  currentUser: User | null;
  canManageTournament: boolean;
  sharedTournament: SharedTournamentState;
  isSharedTournamentReady: boolean;
  onUpdateTournament: (update: Partial<SharedTournamentState> | ((previous: SharedTournamentState) => Partial<SharedTournamentState>)) => void;
  onSavePreset: (newPreset: DraftPreset) => void;
  onDeletePreset: (presetId: string) => void;
}

export const TeamDraft: React.FC<TeamDraftProps> = ({
  users,
  votes,
  teams,
  presets,
  currentUser,
  canManageTournament,
  sharedTournament,
  isSharedTournamentReady,
  onUpdateTournament,
  onSavePreset,
}) => {
  const attendeeIds = sharedTournament.attendeeIds;
  const firstCaptain = attendeeIds.includes(sharedTournament.captainIds[0]) ? sharedTournament.captainIds[0] : '';
  const secondCaptain = sharedTournament.captainIds[1] !== firstCaptain && attendeeIds.includes(sharedTournament.captainIds[1])
    ? sharedTournament.captainIds[1]
    : '';
  const selectedCaptains: [string, string] = [firstCaptain, secondCaptain];
  const draftMode = sharedTournament.draftMode;
  const seriesFormat = sharedTournament.seriesFormat;
  const predefinedTeams = sharedTournament.predefinedTeams;
  const captainDraftTurn = sharedTournament.captainDraftTurn;
  const playerPool = sharedTournament.playerPoolIds;
  const tournamentStarted = sharedTournament.tournamentStarted;
  const draftStage = sharedTournament.draftStage;
  const currentCaptainId = captainDraftTurn === null ? null : selectedCaptains[captainDraftTurn];
  const currentCaptainName = currentCaptainId
    ? users.find((user) => user.id === currentCaptainId)?.name || 'capitão'
    : 'capitão';
  const [captainSearch, setCaptainSearch] = useState<[string, string]>(['', '']);
  const [freeAgentSearch, setFreeAgentSearch] = useState('');
  const [freeAgentLane, setFreeAgentLane] = useState<Lane | 'all'>('all');
  const [freeAgentTier, setFreeAgentTier] = useState<EloTier | 'all'>('all');
  const [presetNameInput, setPresetNameInput] = useState<string>('');
  const [isDraftingAnimation, setIsDraftingAnimation] = useState<boolean>(false);
  const [editingTeamName, setEditingTeamName] = useState<{ id: string; name: string; tag: string } | null>(null);

  // Drag and Drop state
  const [draggedPlayerId, setDraggedPlayerId] = useState<string | null>(null);
  const [dragOverTargetId, setDragOverTargetId] = useState<string | null>(null);

  // New Team Modal / Creation state for Creator
  const [isCreatingNewTeam, setIsCreatingNewTeam] = useState<boolean>(false);
  const [newTeamName, setNewTeamName] = useState<string>('');
  const [newTeamTag, setNewTeamTag] = useState<string>('');
  const [newTeamCaptainId, setNewTeamCaptainId] = useState<string>('');

  const isCreator = canManageTournament;

  const updateTeams = (nextTeams: Team[], changes: Partial<SharedTournamentState> = {}) => onUpdateTournament({
    ...changes,
    teams: nextTeams.map((team) => ({
      ...team,
      members: [...new Set(team.members)].slice(0, TEAM_MEMBER_LIMIT),
    })),
  });

  // Only players who confirmed on the home page can join this tournament's draft.
  const voteAverages = useMemo(() => {
    const totals = new Map<string, { sum: number; count: number }>();
    votes.forEach((vote) => {
      const total = totals.get(vote.targetUserId) || { sum: 0, count: 0 };
      totals.set(vote.targetUserId, { sum: total.sum + vote.score, count: total.count + 1 });
    });
    return new Map([...totals].map(([userId, total]) => [userId, Math.round(total.sum / total.count)] as const));
  }, [votes]);
  const averageFor = (userId: string) => voteAverages.get(userId) ?? null;
  const pointsLabel = (userId: string) => {
    const average = averageFor(userId);
    return average === null ? 'Sem média' : `${average} pts`;
  };
  const displayTeams = teams
    .filter((team) => tournamentStarted || (attendeeIds.includes(team.captainId) && selectedCaptains.includes(team.captainId)))
    .map((team) => ({
      ...team,
      members: [...new Set([
        ...(attendeeIds.includes(team.captainId) ? [team.captainId] : []),
        ...team.members.filter((id) => attendeeIds.includes(id)),
      ])].slice(0, TEAM_MEMBER_LIMIT),
    }));
  const allTeamMembers = displayTeams.flatMap((team) => team.members);
  const freeAgents = users.filter((user) => attendeeIds.includes(user.id) && !allTeamMembers.includes(user.id));

  const filteredFreeAgents = freeAgents.filter((user) => {
    const query = freeAgentSearch.trim().toLowerCase();
    const matchesSearch = !query || [user.name, user.handle, user.primaryLane]
      .some((value) => value.toLowerCase().includes(query));
    const matchesLane = freeAgentLane === 'all' || user.primaryLane === freeAgentLane;
    const userAverage = averageFor(user.id);
    const matchesTier = freeAgentTier === 'all'
      || (userAverage !== null && getTierFromScore(userAverage, Boolean(user.isCriminoso)) === freeAgentTier);
    return matchesSearch && matchesLane && matchesTier;
  });

  const getCaptainCandidates = (slot: number) => {
    const query = captainSearch[slot].trim().toLowerCase();
    return users.filter((user) => user.id !== selectedCaptains[1 - slot]
      && (attendeeIds.includes(user.id) || user.id === selectedCaptains[slot])
      && (!query || [user.name, user.handle, user.primaryLane, String(averageFor(user.id) ?? '')]
        .some((value) => value.toLowerCase().includes(query))));
  };

  const setCaptainSearchForSlot = (slot: number, value: string) => {
    setCaptainSearch((previous) => previous.map((search, index) => index === slot ? value : search) as [string, string]);
  };

  const handleSetCaptain = (slot: number, userId: string) => {
    if (!isCreator || tournamentStarted || !attendeeIds.includes(userId) || selectedCaptains[1 - slot] === userId) return;
    const next: [string, string] = [...selectedCaptains];
    next[slot] = userId;
    onUpdateTournament({ captainIds: next, predefinedTeams: null });
  };

  const buildCaptainTeams = () => selectedCaptains.slice(0, 2).map((capId, idx): Team => {
    const captainUser = users.find((user) => user.id === capId);
    const existingTeam = teams.find((team) => team.captainId === capId);
    return {
      id: existingTeam?.id || `team_gen_${idx}_${Date.now()}`,
      name: existingTeam?.name || `Equipe de ${captainUser?.name || `Capitão ${idx + 1}`}`,
      tag: existingTeam?.tag || `T${idx + 1}`,
      captainId: capId,
      captainName: captainUser?.name || 'Capitão',
      description: existingTeam?.description || 'Equipe montada para a série oficial.',
      logo: existingTeam?.logo || (idx === 0 ? '⚔️' : '🏆'),
      members: [capId],
      seriesFormat,
      side: idx === 0 ? 'azul' : 'vermelho',
      stats: existingTeam?.stats || { matches: 0, wins: 0, losses: 0 },
    };
  });

  const handleStartCaptainDraft = () => {
    if (!isCreator || tournamentStarted || !isSharedTournamentReady) return;
    if (!selectedCaptains.every((captainId) => attendeeIds.includes(captainId))) {
      alert('Os dois capitães precisam confirmar presença na página inicial antes de iniciar o torneio.');
      return;
    }
    const generatedTeams = buildCaptainTeams();
    const nextPool = attendeeIds.filter((id) => !selectedCaptains.includes(id));
    const firstTurn = nextPool.length && generatedTeams.some((team) => team.members.length < TEAM_MEMBER_LIMIT) ? 0 : null;
    updateTeams(generatedTeams, {
      tournamentStarted: true,
      playerPoolIds: nextPool,
      captainDraftTurn: firstTurn,
      draftStage: firstTurn === null ? 'complete' : 'in_progress',
    });
  };

  const handleCaptainPick = (playerId: string) => {
    if (!isSharedTournamentReady || draftStage !== 'in_progress' || captainDraftTurn === null
      || (!isCreator && (!currentUser || currentUser.id !== selectedCaptains[captainDraftTurn]))
      || !attendeeIds.includes(playerId) || !playerPool.includes(playerId)) return;
    const activeTeam = teams[captainDraftTurn];
    if (!activeTeam || activeTeam.members.length >= TEAM_MEMBER_LIMIT) return;
    const nextTeams = teams.map((team, index) => index === captainDraftTurn
      ? { ...team, members: [...team.members, playerId], seriesFormat }
      : team);
    const nextPool = playerPool.filter((id) => id !== playerId);
    const nextPreferred = 1 - captainDraftTurn;
    const nextTurn = nextTeams[nextPreferred]?.members.length < TEAM_MEMBER_LIMIT
      ? nextPreferred
      : nextTeams[captainDraftTurn]?.members.length < TEAM_MEMBER_LIMIT ? captainDraftTurn : null;
    const nextActiveTurn = nextPool.length ? nextTurn : null;
    updateTeams(nextTeams, {
      playerPoolIds: nextPool,
      captainDraftTurn: nextActiveTurn,
      draftStage: nextActiveTurn === null ? 'complete' : 'in_progress',
    });
  };

  const handleSwapCaptains = () => {
    if (!isCreator || tournamentStarted || !selectedCaptains.every(Boolean)) return;
    const nextCaptains: [string, string] = [selectedCaptains[1], selectedCaptains[0]];
    const sideByCaptain = new Map<string, 'azul' | 'vermelho'>([
      [nextCaptains[0], 'azul'],
      [nextCaptains[1], 'vermelho'],
    ]);
    updateTeams(teams.map((team, index) => {
      const captainSide = sideByCaptain.get(team.captainId);
      if (captainSide) return { ...team, side: captainSide };
      return index < 2 ? { ...team, side: team.side === 'azul' ? 'vermelho' : 'azul' } : team;
    }), { captainIds: nextCaptains });
  };

  // Execute Team Draft with animation and chime
  const handleExecuteDraft = (modeToUse: typeof draftMode = draftMode) => {
    if (!isCreator || tournamentStarted || !isSharedTournamentReady) return;
    if (!selectedCaptains.every((captainId) => attendeeIds.includes(captainId))) {
      alert('Os dois capitães precisam confirmar presença na página inicial antes de iniciar o torneio.');
      return;
    }
    if (modeToUse === 'predefined') {
      if (predefinedTeams) {
        const eligibleIds = new Set(attendeeIds);
        const eligibleTeams = predefinedTeams.map((team) => ({
          ...team,
          seriesFormat,
          members: team.members.filter((id) => eligibleIds.has(id)).slice(0, TEAM_MEMBER_LIMIT),
        }));
        if (!selectedCaptains.every((id) => eligibleIds.has(id))) {
          alert('Os dois capitães precisam confirmar presença antes de iniciar o torneio.');
          return;
        }
        updateTeams(eligibleTeams, {
          tournamentStarted: true,
          draftStage: 'complete',
          captainDraftTurn: null,
          playerPoolIds: [],
        });
      }
      return;
    }
    if (modeToUse === 'captain-draft') {
      handleStartCaptainDraft();
      return;
    }
    if (isDraftingAnimation) return;
    setIsDraftingAnimation(true);

    let ticks = 0;
    const interval = setInterval(() => {
      rouletteSound.playRouletteTick();
      ticks++;
      if (ticks >= 8) {
        clearInterval(interval);
        finalizeDraft(modeToUse);
      }
    }, 110);
  };

  const finalizeDraft = (modeToUse: typeof draftMode = draftMode) => {
    const generatedTeams = buildCaptainTeams();
    if (!selectedCaptains.every((id) => attendeeIds.includes(id))) {
      setIsDraftingAnimation(false);
      alert('Os dois capitães precisam confirmar presença antes de iniciar o torneio.');
      return;
    }
    const pool = attendeeIds.filter((id) => !selectedCaptains.includes(id));
    if (modeToUse === 'balanced' && generatedTeams.length === 2) {
      const scoreOf = (playerId: string) => averageFor(playerId) ?? 0;
      const capacities = generatedTeams.map((team) => Math.max(0, TEAM_MEMBER_LIMIT - team.members.length));
      const assignableCount = Math.min(pool.length, capacities.reduce((sum, capacity) => sum + capacity, 0));
      // Randomize equal-score players too, so repeated balanced drafts can vary their rosters.
      const candidates = [...pool]
        .sort(() => Math.random() - 0.5)
        .sort((left, right) => scoreOf(right) - scoreOf(left))
        .slice(0, assignableCount);
      const baseScores = generatedTeams.map((team) => scoreOf(team.captainId));
      const assignment: [string[], string[]] = [[], []];
      const distributions: { members: [string[], string[]]; scores: [number, number] }[] = [];

      const enumerateBalancedAssignments = (playerIndex: number, scores: [number, number]) => {
        if (playerIndex === candidates.length) {
          const rosterSizes = [
            generatedTeams[0].members.length + assignment[0].length,
            generatedTeams[1].members.length + assignment[1].length,
          ];
          if (Math.abs(rosterSizes[0] - rosterSizes[1]) <= 1) {
            distributions.push({ members: [[...assignment[0]], [...assignment[1]]], scores: [...scores] });
          }
          return;
        }

        const playerId = candidates[playerIndex];
        const teamOrder: [number, number] = Math.random() < 0.5 ? [0, 1] : [1, 0];
        teamOrder.forEach((teamIndex) => {
          if (assignment[teamIndex].length >= capacities[teamIndex]) return;
          assignment[teamIndex].push(playerId);
          scores[teamIndex] += scoreOf(playerId);
          enumerateBalancedAssignments(playerIndex + 1, scores);
          scores[teamIndex] -= scoreOf(playerId);
          assignment[teamIndex].pop();
        });
      };

      enumerateBalancedAssignments(0, [baseScores[0], baseScores[1]]);
      if (distributions.length) {
        const difference = (scores: [number, number]) => Math.abs(scores[0] - scores[1]);
        const bestDifference = Math.min(...distributions.map((distribution) => difference(distribution.scores)));
        const closeDistributions = distributions.filter((distribution) => difference(distribution.scores) <= bestDifference + 10);
        const currentSignature = generatedTeams.map((team) => {
          const previousTeam = teams.find((existing) => existing.captainId === team.captainId);
          return [...(previousTeam?.members || team.members)].sort().join(',');
        }).join('|');
        const alternatives = closeDistributions.filter((distribution) => generatedTeams.map((team, index) => [
          ...team.members,
          ...distribution.members[index as 0 | 1],
        ].sort().join(',')).join('|') !== currentSignature);
        const options = alternatives.length ? alternatives : closeDistributions;
        const chosen = options[Math.floor(Math.random() * options.length)];
        generatedTeams.forEach((team, index) => {
          team.members.push(...chosen.members[index as 0 | 1]);
        });
      }
    } else {
      const draftPool = [...pool].sort(() => Math.random() - 0.5);
      draftPool.forEach((playerId, index) => {
        const availableTeamIndexes = generatedTeams
          .map((team, teamIndex) => team.members.length < TEAM_MEMBER_LIMIT ? teamIndex : -1)
          .filter((teamIndex) => teamIndex >= 0);
        if (!availableTeamIndexes.length) return;
        const targetIndex = availableTeamIndexes[index % availableTeamIndexes.length];
        generatedTeams[targetIndex].members.push(playerId);
      });
    }

    const assignedPlayerIds = new Set(generatedTeams.flatMap((team) => team.members));
    updateTeams(generatedTeams, {
      tournamentStarted: true,
      draftStage: 'complete',
      captainDraftTurn: null,
      playerPoolIds: attendeeIds.filter((id) => !assignedPlayerIds.has(id)),
    });
    setIsDraftingAnimation(false);
    rouletteSound.playRouletteFinish();

  };

  // ==========================================
  // DRAG AND DROP HANDLERS (ARRASSTAR E SOLTAR)
  // ==========================================
  const handleDragStart = (playerId: string) => {
    if (!isCreator || draftStage === 'in_progress') return;
    setDraggedPlayerId(playerId);
  };

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    setDragOverTargetId(targetId);
  };

  const handleDragLeave = () => {
    setDragOverTargetId(null);
  };

  const handleDropOnTeam = (teamId: string) => {
    if (!isCreator || !draggedPlayerId || draftStage === 'in_progress') return;

    const targetTeam = teams.find((team) => team.id === teamId);
    if (targetTeam && !targetTeam.members.includes(draggedPlayerId) && targetTeam.members.length >= TEAM_MEMBER_LIMIT) {
      alert(`Cada equipe pode ter no máximo ${TEAM_MEMBER_LIMIT} jogadores.`);
      setDraggedPlayerId(null);
      setDragOverTargetId(null);
      return;
    }

    // Remove player from whichever team they were in, and add to teamId
    const updated = teams.map((team) => {
      // If player is already in this target team, no change
      if (team.id === teamId) {
        if (!team.members.includes(draggedPlayerId)) {
          return { ...team, members: [...team.members, draggedPlayerId] };
        }
        return team;
      }
      // Remove from other teams
      if (team.members.includes(draggedPlayerId)) {
        return { ...team, members: team.members.filter((m) => m !== draggedPlayerId) };
      }
      return team;
    });

    updateTeams(updated);
    setDraggedPlayerId(null);
    setDragOverTargetId(null);
  };

  const handleDropOnFreeAgents = () => {
    if (!isCreator || !draggedPlayerId || draftStage === 'in_progress') return;

    // Remove player from all teams, sending back to free agents
    const updated = teams.map((team) => {
      // Don't remove captain from their own team unless creator
      if (team.captainId === draggedPlayerId && !isCreator) {
        alert('O capitão não pode ser solto nos Agentes Livres.');
        return team;
      }
      return {
        ...team,
        members: team.members.filter((m) => m !== draggedPlayerId),
      };
    });

    updateTeams(updated);
    setDraggedPlayerId(null);
    setDragOverTargetId(null);
  };

  // Creator Manual Team Creation
  const handleCreateCustomTeam = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isCreator || tournamentStarted || !newTeamName.trim() || !attendeeIds.includes(newTeamCaptainId)) return;

    const capUser = users.find((u) => u.id === newTeamCaptainId);
    const newTeam: Team = {
      id: `team_custom_${Date.now()}`,
      name: newTeamName.trim(),
      tag: newTeamTag.trim().toUpperCase() || 'TIME',
      captainId: newTeamCaptainId,
      captainName: capUser?.name || 'Capitão',
      description: 'Equipe criada manualmente pelo Criador Supremo.',
      logo: '🛡️',
      members: [newTeamCaptainId],
      seriesFormat,
      stats: { matches: 0, wins: 0, losses: 0 },
    };

    updateTeams([...teams, newTeam]);
    setIsCreatingNewTeam(false);
    setNewTeamName('');
    setNewTeamTag('');
  };

  const handleDeleteTeam = (teamId: string) => {
    if (!isCreator) return;
    if (confirm('Dissolver esta equipe? Os outros jogadores voltarão aos Agentes Livres e o capitão permanecerá sozinho.')) {
      updateTeams(teams.map((team) => team.id === teamId
        ? { ...team, members: team.captainId ? [team.captainId] : [] }
        : team));
    }
  };

  const handleRemoveMember = (teamId: string, playerId: string) => {
    if (!isCreator || draftStage === 'in_progress') return;
    const updated = teams.map((t) => {
      if (t.id === teamId) {
        if (t.captainId === playerId && !isCreator) {
          alert('O Capitão não pode ser removido do seu próprio time.');
          return t;
        }
        return { ...t, members: t.members.filter((m) => m !== playerId) };
      }
      return t;
    });
    updateTeams(updated);
  };

  const handleSaveTeamName = (teamId: string) => {
    if (!isCreator || !editingTeamName) return;
    const updated = teams.map((t) =>
      t.id === teamId
        ? { ...t, name: editingTeamName.name.trim() || t.name, tag: editingTeamName.tag.trim() || t.tag }
        : t
    );
    updateTeams(updated);
    setEditingTeamName(null);
  };

  const handleSaveCurrentPreset = () => {
    if (!isCreator || tournamentStarted || !presetNameInput.trim()) return;
    const newPreset: DraftPreset = {
      id: `preset_${Date.now()}`,
      name: presetNameInput.trim(),
      captainIds: selectedCaptains,
      poolPlayerIds: playerPool,
      teams: teams,
      createdAt: new Date().toISOString(),
    };
    onSavePreset(newPreset);
    setPresetNameInput('');
  };

  const handleLoadPreset = (preset: DraftPreset) => {
    if (!isCreator || tournamentStarted) return;
    const nextCaptains: [string, string] = [
      attendeeIds.includes(preset.captainIds[0] || '') ? preset.captainIds[0] : '',
      attendeeIds.includes(preset.captainIds[1] || '') && preset.captainIds[1] !== preset.captainIds[0] ? preset.captainIds[1] : '',
    ];
    const eligibleIds = new Set(attendeeIds);
    const loadedTeams = preset.teams?.length ? preset.teams.map((team) => ({ ...team, members: [...new Set(team.members.filter((id) => eligibleIds.has(id)))].slice(0, TEAM_MEMBER_LIMIT) })) : preset.captainIds.slice(0, 2).map((capId, index): Team => {
      const captain = users.find((user) => user.id === capId);
      const existing = teams.find((team) => team.captainId === capId);
      return {
        id: existing?.id || `team_preset_${preset.id}_${index}`,
        name: existing?.name || `Equipe de ${captain?.name || `Capitão ${index + 1}`}`,
        tag: existing?.tag || `T${index + 1}`,
        captainId: capId,
        captainName: captain?.name || 'Capitão',
        description: existing?.description || 'Formação salva para a partida.',
        logo: existing?.logo || (index === 0 ? '⚔️' : '🏆'),
        members: [capId],
        seriesFormat,
        side: index === 0 ? 'azul' : 'vermelho',
        stats: existing?.stats || { matches: 0, wins: 0, losses: 0 },
      };
    });
    if (loadedTeams.length) {
      const pool = preset.poolPlayerIds.filter((id) => eligibleIds.has(id) && !preset.captainIds.includes(id));
      if (!preset.teams?.length) pool.forEach((playerId, index) => {
        const team = loadedTeams[index % loadedTeams.length];
        if (team.members.length < TEAM_MEMBER_LIMIT) team.members.push(playerId);
      });
      updateTeams(loadedTeams, {
        captainIds: nextCaptains,
        playerPoolIds: pool,
        draftMode: 'predefined',
        predefinedTeams: loadedTeams,
        captainDraftTurn: null,
        draftStage: 'setup',
        tournamentStarted: false,
      });
    }
  };

  return (
    <div className="space-y-8 text-sm">
      {/* ========================================================= */}
      {/* 1. SORTEAR EQUIPES NO TOPO (SOLICITADO PELO USUÁRIO)       */}
      {/* ========================================================= */}
      <div className="relative overflow-hidden rounded-3xl border border-amber-700/40 bg-gradient-to-br from-slate-950 via-[#111827] to-[#220d16] p-5 shadow-2xl shadow-black/30 backdrop-blur-md space-y-5 md:p-7">
        <div aria-hidden="true" className="pointer-events-none absolute -right-28 -top-32 h-80 w-80 rounded-full bg-amber-500/10 blur-3xl" />
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-4 border-b border-red-900/30">
          <div>
            <div className="flex items-center gap-2">
              <span className="grid h-11 w-11 place-items-center rounded-2xl border border-amber-500/30 bg-gradient-to-br from-red-950 to-amber-950/60 text-amber-300 shadow-inner">
                <Shuffle className="h-5 w-5" />
              </span>
              <h2 className="font-display text-2xl font-black text-white md:text-3xl">
                Sortear e Montar Equipes
              </h2>
            </div>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-300">
              {isCreator
                ? 'Configure o sorteio ou monte os elencos. Cada equipe pode ter até 5 jogadores.'
                : 'Acompanhe a configuração e as escolhas ao vivo. Cada equipe pode ter até 5 jogadores.'}
            </p>
          </div>

          {/* Action buttons & Presets */}
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            {isCreator && !tournamentStarted && (
              <button
                onClick={() => setIsCreatingNewTeam(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 text-black font-extrabold text-xs shadow-md transition-all"
              >
                <Plus className="w-4 h-4" /> Criar Equipe Manualmente
              </button>
            )}

            {isCreator && !tournamentStarted && <div className="flex items-center gap-1">
              <input
                type="text"
                placeholder="Salvar Preset..."
                value={presetNameInput}
                onChange={(e) => setPresetNameInput(e.target.value)}
                className="px-2.5 py-1.5 text-xs rounded-xl bg-slate-900 border border-slate-700 text-white w-32 placeholder-slate-500"
              />
              <button
                onClick={handleSaveCurrentPreset}
                disabled={!presetNameInput.trim()}
                className="p-2 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white font-bold text-xs transition-colors"
                title="Salvar formação atual"
              >
                <Save className="w-4 h-4" />
              </button>

              {presets.length > 0 && (
                <select
                  onChange={(e) => {
                    const found = presets.find((p) => p.id === e.target.value);
                    if (found) handleLoadPreset(found);
                  }}
                  defaultValue=""
                  className="px-2.5 py-1.5 text-xs rounded-xl bg-slate-900 border border-slate-700 text-slate-300"
                >
                  <option value="" disabled>Carregar Preset...</option>
                  {presets.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              )}
            </div>}
            {tournamentStarted && <span className="rounded-full border border-emerald-700/40 bg-emerald-950/40 px-3 py-2 text-[10px] font-bold text-emerald-200">TORNEIO INICIADO · {attendeeIds.length} CONFIRMADOS</span>}
          </div>
        </div>

        {/* Modal: Criar Equipe Manualmente (Criador) */}
        {isCreator && isCreatingNewTeam && (
          <div className="p-4 rounded-xl bg-slate-900 border border-amber-500/50 shadow-xl space-y-3">
            <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
              <Crown className="w-4 h-4 text-amber-400" />
              Criar Nova Equipe Personalizada (Poder do Criador)
            </h4>
            <form onSubmit={handleCreateCustomTeam} className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <input
                type="text"
                placeholder="Nome da Equipe (ex: Dragões do Rift)"
                value={newTeamName}
                required
                onChange={(e) => setNewTeamName(e.target.value)}
                className="p-2 rounded bg-slate-950 border border-slate-700 text-white"
              />
              <input
                type="text"
                placeholder="Tag (ex: DRG)"
                value={newTeamTag}
                required
                maxLength={4}
                onChange={(e) => setNewTeamTag(e.target.value)}
                className="p-2 rounded bg-slate-950 border border-slate-700 text-white font-mono"
              />
              <select
                value={newTeamCaptainId}
                onChange={(e) => setNewTeamCaptainId(e.target.value)}
                className="p-2 rounded bg-slate-950 border border-slate-700 text-white"
              >
                <option value="" disabled>Selecione o Capitão...</option>
                {users.filter((u) => attendeeIds.includes(u.id)).map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.primaryLane} · {displayLogin(u.handle)})
                  </option>
                ))}
              </select>

              <div className="sm:col-span-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreatingNewTeam(false)}
                  className="px-3 py-1.5 rounded bg-slate-800 text-slate-300 text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs"
                >
                  Criar Time para Arrastar Membros
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="relative grid grid-cols-1 items-start gap-3 xl:grid-cols-[minmax(190px,1fr)_minmax(360px,1.5fr)_minmax(190px,1fr)]">
          {[0, 1].map((slot) => {
            const captain = users.find((user) => user.id === selectedCaptains[slot]);
            return (
              <section key={slot} className={`rounded-2xl border p-4 ${slot === 0 ? 'border-sky-700/50 bg-sky-950/15 xl:order-1' : 'border-red-700/50 bg-red-950/15 xl:order-3'}`}>
                <label className="mb-2 block text-xs font-bold text-white">
                  <Crown className={`mr-1 inline h-4 w-4 ${slot === 0 ? 'text-sky-300' : 'text-red-300'}`} /> Capitão do lado {slot === 0 ? 'Azul' : 'Vermelho'}
                </label>
                {isCreator && !tournamentStarted ? <>
                  {attendeeIds.length > 0 && <label className="relative mb-2 block">
                    <span className="sr-only">Pesquisar capitão do lado {slot === 0 ? 'azul' : 'vermelho'}</span>
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
                    <input
                      value={captainSearch[slot]}
                      onChange={(event) => setCaptainSearchForSlot(slot, event.target.value)}
                      placeholder="Pesquisar entre presenças confirmadas"
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 py-2 pl-8 pr-2 text-[10px] text-white placeholder:text-slate-500"
                    />
                  </label>}
                  <select disabled={!isSharedTournamentReady || attendeeIds.length === 0} value={selectedCaptains[slot]} onChange={(event) => handleSetCaptain(slot, event.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-xs text-white disabled:opacity-50">
                    <option value="">{attendeeIds.length > 0 ? 'Selecione um jogador confirmado…' : 'Aguardando confirmações de presença'}</option>
                    {getCaptainCandidates(slot).map((user) => <option key={user.id} value={user.id}>{user.name} · {user.primaryLane} · {pointsLabel(user.id)}</option>)}
                  </select>
                </> : <div className="rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-xs font-bold text-white">{captain ? `${captain.name} · ${captain.primaryLane} · ${pointsLabel(captain.id)}` : 'Aguardando o criador escolher um capitão'}</div>}
                {captain && <div className="mt-3 flex items-center gap-2 rounded-xl bg-slate-950/70 p-2">
                  <img src={captain.avatar} alt="" className="h-9 w-9 rounded-lg object-cover" />
                  <span className="min-w-0"><strong className="block truncate text-xs text-white">{captain.name}</strong><span className="font-mono text-[10px] text-slate-400">{displayLogin(captain.handle)} · {pointsLabel(captain.id)}</span></span>
                </div>}
              </section>
            );
          })}

          <section className="space-y-3 rounded-2xl border border-amber-700/40 bg-slate-950/70 p-4 xl:order-2">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Como montar os times</span>
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                {([
                  ['random', 'Sorteio'], ['predefined', 'Pré-definido'], ['balanced', 'Balanceado'], ['captain-draft', 'Capitães escolhem'],
                ] as const).map(([mode, label]) => <button key={mode} type="button" disabled={!isCreator || tournamentStarted || !isSharedTournamentReady} onClick={() => onUpdateTournament({ draftMode: mode as TeamDraftMode, predefinedTeams: mode === 'predefined' ? predefinedTeams : null, draftStage: 'setup' })} className={`rounded-lg border px-2 py-2 text-[11px] font-bold transition disabled:cursor-default disabled:opacity-70 ${draftMode === mode ? 'border-amber-400 bg-amber-500/15 text-amber-200' : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500'}`}>{label}</button>)}
              </div>
              {draftMode === 'predefined' && <p className="mt-2 text-[10px] text-amber-200">{predefinedTeams ? 'Formação carregada; aplicar restaura esses times.' : 'Carregue uma formação salva no seletor acima.'}</p>}
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-slate-800 pt-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Formato</span>
              <div className="flex rounded-lg border border-slate-700 bg-slate-900 p-0.5">
                {(['MD1', 'MD3', 'MD5'] as MatchSeriesFormat[]).map((format) => <button key={format} type="button" disabled={!isCreator || tournamentStarted || !isSharedTournamentReady} onClick={() => { updateTeams(teams.map((team) => ({ ...team, seriesFormat: format })), { seriesFormat: format }); }} className={`rounded-md px-2.5 py-1 text-[10px] font-mono font-bold disabled:cursor-default disabled:opacity-70 ${seriesFormat === format ? 'bg-amber-500 text-black' : 'text-slate-400 hover:text-white'}`}>{format}</button>)}
              </div>
            </div>

            {isCreator && !tournamentStarted && <button type="button" disabled={!isSharedTournamentReady || !selectedCaptains.every(Boolean)} onClick={handleSwapCaptains} className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-xs font-bold text-slate-200 transition hover:border-amber-400 disabled:opacity-50"><Shuffle className="h-3.5 w-3.5" /> Trocar capitães de lado</button>}

            {isCreator && !tournamentStarted ? <button onClick={() => handleExecuteDraft()} disabled={!isSharedTournamentReady || !selectedCaptains.every(Boolean) || isDraftingAnimation || (draftMode === 'predefined' && !predefinedTeams)} className={`flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-red-600 via-rose-600 to-red-700 py-3 text-sm font-extrabold text-white shadow-xl shadow-red-950 transition-all disabled:cursor-not-allowed disabled:opacity-50 ${isDraftingAnimation ? 'scale-95 animate-pulse' : 'hover:scale-[1.02]'}`}>
              <Shuffle className={`h-4 w-4 ${isDraftingAnimation ? 'animate-spin' : ''}`} />
              {isDraftingAnimation ? 'Montando equipes…' : draftMode === 'captain-draft' ? 'Iniciar torneio e draft' : draftMode === 'predefined' ? 'Iniciar torneio com preset' : draftMode === 'balanced' ? 'Iniciar torneio · equipes balanceadas' : 'Iniciar torneio · sortear equipes'}
            </button> : <div role="status" className="rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-3 text-center text-xs font-semibold text-slate-300">
              {!isSharedTournamentReady ? 'Sincronizando o torneio…' : !tournamentStarted ? 'Aguardando o criador iniciar o torneio.' : draftStage === 'in_progress' && captainDraftTurn !== null ? `Draft em andamento · vez de ${users.find((user) => user.id === selectedCaptains[captainDraftTurn])?.name || 'um capitão'}.` : 'Torneio iniciado · equipes definidas.'}
            </div>}
          </section>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 2. EQUIPES FORMADAS & DRAG AND DROP (ARRASTAR E SOLTAR)    */}
      {/* ========================================================= */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-2 border-b border-red-900/40">
          <div>
            <h3 className="text-xl font-display font-black text-white flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-400" />
              Equipes Formadas ({displayTeams.length}) · Arraste para Mover
            </h3>
            <p className="text-xs text-slate-400">
              {draftStage === 'in_progress'
                ? isCreator
                  ? 'Os capitães escolhem alternadamente; você pode escolher por qualquer capitão, um jogador por vez.'
                  : 'Os capitães escolhem alternadamente um jogador confirmado por vez.'
                : isCreator
                  ? '💡 Segure e arraste jogadores confirmados entre equipes ou para os Agentes Livres.'
                  : 'Acompanhe as equipes e o draft ao vivo. Apenas o criador configura e inicia o torneio.'}
            </p>
          </div>

          {isCreator && (
            <span className="text-xs font-mono text-amber-300 bg-amber-950/60 px-2.5 py-1 rounded-lg border border-amber-500/40">
              👑 Modo Criador: Arraste livre liberado
            </span>
          )}
        </div>

        {/* Teams Grid with Drop Zones */}
            <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-6 md:grid-cols-2">
          {displayTeams.length === 0 && <div className="col-span-full rounded-2xl border border-dashed border-slate-800 bg-slate-950/50 p-6 text-center text-xs text-slate-500">Confirme presença na página inicial. Depois, o criador poderá escolher os capitães e montar as equipes.</div>}
          {displayTeams.map((team, teamIndex) => {
            const captainUser = users.find((u) => u.id === team.captainId);
            const isHoveredDrop = dragOverTargetId === team.id;
            const teamFrame = [
              'border-red-900/50 bg-gradient-to-br from-slate-950 via-slate-950 to-red-950/25 hover:border-red-500/70',
              'border-sky-900/50 bg-gradient-to-br from-slate-950 via-slate-950 to-sky-950/25 hover:border-sky-500/70',
              'border-violet-900/50 bg-gradient-to-br from-slate-950 via-slate-950 to-violet-950/25 hover:border-violet-500/70',
              'border-amber-900/50 bg-gradient-to-br from-slate-950 via-slate-950 to-amber-950/25 hover:border-amber-500/70',
            ][teamIndex % 4];

            return (
              <div
                key={team.id}
                onDragOver={(e) => { if (isCreator) handleDragOver(e, team.id); }}
                onDragLeave={handleDragLeave}
                onDrop={() => handleDropOnTeam(team.id)}
                className={`flex flex-col justify-between rounded-2xl border-2 p-5 shadow-2xl transition-all ${
                  isHoveredDrop
                    ? 'border-amber-400 bg-slate-900 shadow-[0_0_25px_rgba(245,158,11,0.3)] scale-[1.01]'
                    : teamFrame
                }`}
              >
                <div>
                  {/* Team Title & Series Format */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl p-2 rounded-xl bg-slate-900 border border-slate-800">
                        {team.logo || '⚔️'}
                      </span>
                      <div>
                        {isCreator && editingTeamName?.id === team.id ? (
                          <div className="flex items-center gap-1.5 mt-1">
                            <input
                              type="text"
                              value={editingTeamName.name}
                              onChange={(e) => setEditingTeamName({ ...editingTeamName, name: e.target.value })}
                              className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-xs text-white"
                            />
                            <input
                              type="text"
                              value={editingTeamName.tag}
                              onChange={(e) => setEditingTeamName({ ...editingTeamName, tag: e.target.value })}
                              className="w-14 px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-xs text-white font-mono"
                            />
                            <button
                              onClick={() => handleSaveTeamName(team.id)}
                              className="px-2 py-0.5 bg-red-600 text-white rounded text-xs font-bold"
                            >
                              Salvar
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <h4 className="font-display font-black text-lg text-white tracking-wide">
                              {team.name}
                            </h4>
                            <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-red-950 text-red-300 border border-red-800/40">
                              [{team.tag}]
                            </span>
                            {isCreator && (
                              <button
                                onClick={() => setEditingTeamName({ id: team.id, name: team.name, tag: team.tag })}
                                className="text-[10px] text-amber-400 hover:text-amber-300 underline font-mono"
                              >
                                Editar Nome
                              </button>
                            )}
                          </div>
                        )}

                        <span className="text-[11px] text-slate-400 mt-0.5 block">
                          Capitão: <strong className="text-amber-300">{captainUser?.name || team.captainName}</strong>
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <span className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 font-mono text-[10px] font-bold text-amber-200">{team.seriesFormat || seriesFormat}</span>
                      {team.side && <span className={`rounded-lg border px-2 py-1 text-[10px] font-bold uppercase ${team.side === 'azul' ? 'border-sky-500/50 bg-sky-950 text-sky-200' : 'border-red-500/50 bg-red-950 text-red-200'}`}>Lado {team.side}</span>}

                      {isCreator && (
                        <button
                          onClick={() => handleDeleteTeam(team.id)}
                          className="text-[10px] text-red-400 hover:text-red-300 flex items-center gap-0.5 mt-1"
                          title="Dissolver Equipe"
                        >
                          <Trash2 className="w-3 h-3" /> Dissolver
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Members list (DRAGGABLE CARDS) */}
                  <div className="mt-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                        {isCreator ? `Elenco (${team.members.length}/${TEAM_MEMBER_LIMIT}) · Arraste para mover` : `Elenco (${team.members.length}/${TEAM_MEMBER_LIMIT})`}
                      </span>
                    </div>

                    <div className="space-y-1.5 min-h-[140px] p-2 rounded-xl bg-slate-900/40 border-2 border-dashed border-slate-800">
                      {team.members.length === 0 ? (
                        <div className="h-28 flex flex-col items-center justify-center text-slate-500 text-xs">
                          <span>Nenhum jogador na equipe.</span>
                          {isCreator && <span className="text-amber-400/80 mt-1 font-semibold">Arraste jogadores aqui!</span>}
                        </div>
                      ) : (
                        team.members.map((mId) => {
                          const mUser = users.find((u) => u.id === mId);
                          if (!mUser) return null;
                          const isCap = mId === team.captainId;

                          return (
                            <div
                              key={mId}
                              draggable={isCreator && draftStage !== 'in_progress'}
                              onDragStart={() => handleDragStart(mId)}
                              className={`flex items-center justify-between p-2 rounded-xl bg-slate-900/90 border border-slate-700/80 shadow-sm transition-all ${isCreator ? 'cursor-grab hover:bg-slate-800 active:cursor-grabbing' : ''}`}
                            >
                              <div className="flex items-center gap-2">
                                {isCreator && <GripVertical className="w-3.5 h-3.5 text-slate-500 shrink-0" />}
                                <img
                                  src={mUser.avatar}
                                  alt={mUser.name}
                                  className="w-6 h-6 rounded-full object-cover"
                                />
                                <div>
                                  <span className={`font-semibold ${isCap ? 'text-amber-300' : 'text-slate-200'}`}>
                                    {mUser.name}
                                  </span>
                                  {isCap && <span className="ml-1 text-[10px] text-amber-400 font-mono">(Capitão)</span>}
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-mono text-amber-400 bg-black/50 px-1.5 py-0.5 rounded">
                                  {mUser.primaryLane} · {pointsLabel(mUser.id)}
                                </span>

                                {isCreator && draftStage !== 'in_progress' && (
                                  <button
                                    onClick={() => handleRemoveMember(team.id, mId)}
                                    className="p-1 rounded bg-red-950/80 hover:bg-red-900 text-red-300 transition-colors"
                                    title="Dispensar para os Agentes Livres"
                                  >
                                    <UserMinus className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Free Agents Showcase & Drop Zone */}
        <div
          onDragOver={(e) => { if (isCreator) handleDragOver(e, 'free_agents'); }}
          onDragLeave={handleDragLeave}
          onDrop={handleDropOnFreeAgents}
          className={`p-4 rounded-2xl bg-slate-950/90 border-2 transition-all ${
            dragOverTargetId === 'free_agents'
              ? 'border-emerald-400 bg-slate-900 shadow-[0_0_20px_rgba(52,211,153,0.3)]'
              : 'border-slate-800'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-400" />
              <h4 className="font-display font-bold text-sm text-white">
                Jogadores confirmados disponíveis ({freeAgents.length})
              </h4>
            </div>
            <span className="text-[11px] text-slate-400">
              {isCreator ? 'Arraste para montar as equipes antes de iniciar.' : 'Somente presenças confirmadas entram no sorteio.'}
            </span>
          </div>

          <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-[minmax(180px,1.5fr)_repeat(2,minmax(130px,1fr))]">
            <label className="relative block">
              <span className="sr-only">Pesquisar agentes livres</span>
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
              <input
                value={freeAgentSearch}
                onChange={(event) => setFreeAgentSearch(event.target.value)}
                placeholder="Pesquisar nome, login ou rota"
                className="w-full rounded-xl border border-slate-700 bg-slate-900 py-2 pl-9 pr-3 text-xs text-white placeholder:text-slate-500"
              />
            </label>
            <select value={freeAgentLane} onChange={(event) => setFreeAgentLane(event.target.value as Lane | 'all')} aria-label="Filtrar agentes por rota" className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white">
              <option value="all">Todas as rotas</option>
              {(['TOP', 'JUNGLE', 'MID', 'ADC', 'SUPORTE', 'PREENCHER'] as Lane[]).map((lane) => <option key={lane} value={lane}>{lane === 'JUNGLE' ? 'Jungler' : lane === 'PREENCHER' ? 'Preencher' : lane}</option>)}
            </select>
            <select value={freeAgentTier} onChange={(event) => setFreeAgentTier(event.target.value as EloTier | 'all')} aria-label="Filtrar agentes por elo" className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white">
              <option value="all">Todos os elos</option>
              {tierOptions.map((tier) => <option key={tier.value} value={tier.value}>{tier.label}</option>)}
            </select>
          </div>

          {freeAgents.length === 0 ? (
            <div className="p-4 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl">
              {isCreator ? 'Nenhum jogador livre. Arraste membros de uma equipe para cá para liberar no mercado.' : 'Nenhum jogador confirmado está aguardando escolha.'}
            </div>
          ) : filteredFreeAgents.length === 0 ? (
            <div className="p-4 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl">
              Nenhum agente livre corresponde à pesquisa e aos filtros.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
              {filteredFreeAgents.map((fa) => (
                <div
                  key={fa.id}
                  draggable={isCreator && draftStage !== 'in_progress'}
                  onDragStart={() => handleDragStart(fa.id)}
                  className={`p-2.5 rounded-xl bg-slate-900/80 border border-slate-700/80 shadow-sm flex flex-col justify-between transition-all ${isCreator ? 'cursor-grab hover:bg-slate-800 active:cursor-grabbing transform hover:-translate-y-0.5' : ''}`}
                >
                  <div className="flex items-center gap-1.5 mb-1.5">
                    {isCreator && <GripVertical className="w-3 h-3 text-slate-500 shrink-0" />}
                    <img
                      src={fa.avatar}
                      alt={fa.name}
                      className="w-6 h-6 rounded-full object-cover"
                    />
                    <div className="truncate">
                      <div className="text-xs font-bold text-white truncate">{fa.name}</div>
                      <div className="text-[10px] font-mono text-slate-400">{fa.primaryLane}</div>
                    </div>
                  </div>

                  <div className={`border-t border-slate-800 pt-1 text-[10px] font-mono ${draftStage === 'in_progress' ? 'space-y-1.5' : ''}`}>
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-bold text-amber-400">{pointsLabel(fa.id)}</span>
                      {draftStage === 'in_progress' && captainDraftTurn !== null
                        ? <span className="truncate text-[9px] text-sky-200" title={`Vez de ${currentCaptainName}`}>
                            {currentUser?.id === currentCaptainId ? 'Sua vez' : `Vez: ${currentCaptainName}`}
                          </span>
                        : <span className="rounded bg-emerald-950/80 px-1 text-[9px] text-emerald-400">{tournamentStarted ? 'TORNEIO' : 'PRESENÇA'}</span>}
                    </div>
                    {draftStage === 'in_progress' && captainDraftTurn !== null
                      && (isCreator || currentUser?.id === currentCaptainId) && (
                        <button
                          type="button"
                          disabled={!isSharedTournamentReady || !playerPool.includes(fa.id) || !teams[captainDraftTurn] || teams[captainDraftTurn].members.length >= TEAM_MEMBER_LIMIT}
                          onClick={() => handleCaptainPick(fa.id)}
                          title={isCreator && currentUser?.id !== currentCaptainId ? `Escolher por ${currentCaptainName}` : 'Escolher um jogador'}
                          className="w-full rounded bg-amber-500 px-2 py-1 text-[9px] font-black text-black hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {isCreator && currentUser?.id !== currentCaptainId ? `Escolher por ${currentCaptainName}` : 'Escolher 1 jogador'}
                        </button>
                      )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  );
};
