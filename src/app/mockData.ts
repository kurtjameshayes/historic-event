export const MOCK_DAG_DATA = {
  target_event: {
    name: "Fall of the Berlin Wall",
    date: "November 9, 1989",
    description: "The pivotal event in world history which marked the falling of the Iron Curtain and the start of the fall of communism in Eastern and Central Europe."
  },
  threads: [
    { id: "t-pol", name: "Political / Diplomatic", description: "Changes in Soviet and East German leadership and policy.", color: "bg-blue-500 border-blue-600 text-blue-800" },
    { id: "t-eco", name: "Economic", description: "Stagnation and economic crises within the Eastern Bloc.", color: "bg-green-500 border-green-600 text-green-800" },
    { id: "t-soc", name: "Social / Civil", description: "Protests, civil unrest, and border crossings by citizens.", color: "bg-amber-500 border-amber-600 text-amber-800" }
  ],
  events: [
    {
      id: "e-1",
      date: "Mar 1985",
      timestamp: new Date("1985-03-01").getTime(),
      title: "Gorbachev becomes General Secretary",
      description: "Mikhail Gorbachev assumes power in the Soviet Union, realizing the need for significant economic and political reform.",
      thread_id: "t-pol",
      sources: [
        { url: "#", title: "Soviet Archives - 1985 Leadership Transition", quality: "primary", excerpt: "Gorbachev elected General Secretary by the Politburo." }
      ]
    },
    {
      id: "e-2",
      date: "1980s",
      timestamp: new Date("1985-06-01").getTime(), // Approximated for visual flow after e-1
      title: "Eastern Bloc Economic Stagnation",
      description: "Severe shortages of consumer goods, technological backwardness, and massive foreign debt cripple the GDR economy.",
      thread_id: "t-eco",
      sources: [
        { url: "#", title: "Economic History of the GDR", quality: "secondary", excerpt: "By the late 1980s, East Germany was essentially bankrupt, reliant on West German loans." }
      ]
    },
    {
      id: "e-3",
      date: "1986-1988",
      timestamp: new Date("1987-01-01").getTime(),
      title: "Glasnost and Perestroika",
      description: "Gorbachev introduces policies of openness (Glasnost) and restructuring (Perestroika), loosening Soviet grip on Eastern Europe.",
      thread_id: "t-pol",
      sources: [
        { url: "#", title: "Perestroika: New Thinking for Our Country and the World", quality: "primary", excerpt: "We need a radical restructuring of our economy and democratization of our society." }
      ]
    },
    {
      id: "e-4",
      date: "May 1989",
      timestamp: new Date("1989-05-02").getTime(),
      title: "Hungary Dismantles Border Fence",
      description: "Hungary begins dismantling its fortified border with Austria, creating a physical hole in the Iron Curtain.",
      thread_id: "t-pol",
      sources: [
        { url: "#", title: "Hungarian Border Guards Report", quality: "primary", excerpt: "The electric alarm system has been deactivated." }
      ]
    },
    {
      id: "e-5",
      date: "Aug 19, 1989",
      timestamp: new Date("1989-08-19").getTime(),
      title: "Pan-European Picnic",
      description: "A peace demonstration on the Austrian-Hungarian border where hundreds of GDR citizens escape to the West.",
      thread_id: "t-soc",
      sources: [
        { url: "#", title: "The Pan-European Picnic Foundation", quality: "secondary", excerpt: "Over 600 East Germans rushed the gate, the border guards did not shoot." }
      ]
    },
    {
      id: "e-6",
      date: "Sep - Oct 1989",
      timestamp: new Date("1989-09-25").getTime(),
      title: "Monday Demonstrations (Leipzig)",
      description: "Massive peaceful protests begin in Leipzig and spread across East Germany, demanding democratic reforms and freedom to travel.",
      thread_id: "t-soc",
      sources: [
        { url: "#", title: "Stasi Surveillance Reports - Leipzig", quality: "primary", excerpt: "Crowds chanting 'Wir sind das Volk' (We are the people)." }
      ]
    },
    {
      id: "e-7",
      date: "Oct 18, 1989",
      timestamp: new Date("1989-10-18").getTime(),
      title: "Honecker Resigns",
      description: "Erich Honecker, the hardline GDR leader, is forced to resign by the Politburo, replaced by Egon Krenz.",
      thread_id: "t-pol",
      sources: [
        { url: "#", title: "GDR Politburo Minutes", quality: "primary", excerpt: "Honecker cites health reasons for resignation following loss of Soviet support." }
      ]
    },
    {
      id: "e-8",
      date: "Nov 9, 1989 (Early Evening)",
      timestamp: new Date("1989-11-09T18:00:00Z").getTime(),
      title: "Schabowski's Press Conference",
      description: "GDR official Günter Schabowski mistakenly announces that new travel regulations allowing border crossings are effective 'immediately, without delay'.",
      thread_id: "t-pol",
      sources: [
        { url: "#", title: "Live Broadcast of SED Press Conference", quality: "primary", excerpt: "'As far as I know, it takes effect immediately, without delay.' - Schabowski" }
      ]
    },
    {
      id: "e-9",
      date: "Nov 9, 1989 (Night)",
      timestamp: new Date("1989-11-09T22:00:00Z").getTime(),
      title: "Crowds Mass at Checkpoints",
      description: "Thousands of East Berliners gather at border crossings demanding to be let through based on the TV broadcast.",
      thread_id: "t-soc",
      sources: [
        { url: "#", title: "Bornholmer Straße Checkpoint Logs", quality: "primary", excerpt: "Crowd growing unmanageable. Awaiting orders. No orders received." }
      ]
    },
    {
      id: "e-target",
      date: "Nov 9, 1989 (Late Night)",
      timestamp: new Date("1989-11-09T23:30:00Z").getTime(),
      title: "Fall of the Berlin Wall",
      description: "Overwhelmed border guards at Bornholmer Straße open the barriers. Thousands flood into West Berlin, effectively ending the Wall's existence.",
      thread_id: "t-soc",
      is_target: true,
      sources: [
        { url: "#", title: "International News Coverage", quality: "secondary", excerpt: "The wall is open! Scenes of jubilation as East meets West." }
      ]
    }
  ],
  edges: [
    { id: "ed-1", from_event_id: "e-1", to_event_id: "e-3", reasoning: "Gorbachev's ascension allowed for the introduction of progressive reforms.", confidence: 0.95 },
    { id: "ed-2", from_event_id: "e-2", to_event_id: "e-3", reasoning: "Economic failure forced the Soviet bloc to consider restructuring (Perestroika).", confidence: 0.88 },
    { id: "ed-3", from_event_id: "e-3", to_event_id: "e-4", reasoning: "Glasnost signaled that the USSR would not intervene militarily, emboldening Hungary.", confidence: 0.92 },
    { id: "ed-4", from_event_id: "e-4", to_event_id: "e-5", reasoning: "The open border in Hungary provided an escape route, precipitating the Pan-European Picnic.", confidence: 0.85 },
    { id: "ed-5", from_event_id: "e-3", to_event_id: "e-6", reasoning: "The lack of Soviet backing encouraged GDR citizens to protest openly.", confidence: 0.90 },
    { id: "ed-6", from_event_id: "e-5", to_event_id: "e-7", reasoning: "Mass exodus destabilized the GDR regime, causing internal loss of confidence in Honecker.", confidence: 0.82 },
    { id: "ed-7", from_event_id: "e-6", to_event_id: "e-7", reasoning: "Mounting domestic protests made Honecker's hardline position untenable.", confidence: 0.95 },
    { id: "ed-8", from_event_id: "e-7", to_event_id: "e-8", reasoning: "The new leadership under Krenz drafted hasty travel laws to relieve pressure.", confidence: 0.89 },
    { id: "ed-9", from_event_id: "e-8", to_event_id: "e-9", reasoning: "The televised mistake immediately prompted citizens to act.", confidence: 0.99 },
    { id: "ed-10", from_event_id: "e-9", to_event_id: "e-target", reasoning: "The sheer size of the peaceful crowd overwhelmed the guards, leading to the opening.", confidence: 0.98 }
  ],
  narrative: "The Fall of the Berlin Wall was not a spontaneous accident, but the culmination of converging political, economic, and social forces. Economically, the Eastern Bloc, particularly the GDR, had suffered years of stagnation, leaving it reliant on Western loans and unable to sustain its population's standard of living.\n\nPolitically, the ascension of Mikhail Gorbachev in 1985 and his subsequent policies of Glasnost and Perestroika fundamentally altered the geopolitical landscape. By signaling that the Soviet Union would no longer intervene militarily to prop up satellite regimes (the Sinatra Doctrine), he emboldened reform movements. This led directly to Hungary dismantling its border fences in May 1989.\n\nSocially, this crack in the Iron Curtain provided an escape route, culminating in the Pan-European Picnic in August, where hundreds fled. Concurrently, emboldened by the lack of Soviet intervention, massive peaceful 'Monday Demonstrations' erupted in Leipzig. The dual pressure of mass exodus and internal protest forced hardliner Erich Honecker to resign in October.\n\nIn a desperate attempt to relieve the pressure, the new leadership drafted relaxed travel regulations. However, on November 9, a miscommunication during a press conference by Günter Schabowski led citizens to believe borders were open immediately. Thousands flocked to the checkpoints, and the overwhelmed guards, lacking orders and unwilling to use lethal force against peaceful citizens, yielded, opening the barriers and effectively ending the division of Berlin."
};