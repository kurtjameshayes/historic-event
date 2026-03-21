import { TimelineSection, TimelineEvent, TimelineConnection } from './components/TimelineSection';

// ─── Holocaust & European Jewish Crisis ──────────────────────────────────────
const holocaustEvents: TimelineEvent[] = [
  {
    id: 'nazi',
    title: 'Nazi Persecution Period',
    startYear: 1914,
    endYear: 1933,
    row: 0,
    dateRangeLabel: '1914 – 1933',
  },
  {
    id: 'aftermath',
    title: 'Holocaust Aftermath and Israel',
    startYear: 1930,
    endYear: 1948,
    row: 1,
    dateRangeLabel: '1930s – 1948',
  },
  {
    id: 'memory',
    title: 'Holocaust Memory Recognition',
    startYear: 1980,
    endYear: 2022,
    row: 0,
    dateRangeLabel: '1980 – 2022',
  },
];

const holocaustConnections: TimelineConnection[] = [
  { fromId: 'nazi',      toId: 'aftermath' },
  { fromId: 'aftermath', toId: 'memory'    },
];

// ─── UN Partition Resolution Process ─────────────────────────────────────────
const partitionEvents: TimelineEvent[] = [
  {
    id: 'concept',
    title: 'Partition Concept Emergence',
    startYear: 1923,
    endYear: 1937,
    row: 0,
    dateRangeLabel: '1923 – 1937',
  },
  {
    id: 'investigation',
    title: 'UN Investigation Phase',
    startYear: 1938,
    endYear: 1947,
    row: 1,
    dateRangeLabel: '1938 – 1947',
  },
  {
    id: 'deliberation',
    title: 'UN Partition Deliberation',
    startYear: 1947,
    endYear: 1947,
    row: 0,
    dateRangeLabel: '1947',
  },
  {
    id: 'adoption',
    title: 'Partition Resolution Adoption',
    startYear: 1947,
    endYear: 1948,
    row: 2,
    dateRangeLabel: '1947 – 1948',
  },
];

const partitionConnections: TimelineConnection[] = [
  { fromId: 'concept',       toId: 'investigation' },
  { fromId: 'investigation', toId: 'deliberation'  },
  { fromId: 'deliberation',  toId: 'adoption'      },
];

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-8 py-10 space-y-16">

        {/* Page title */}
        <div className="border-b border-gray-200 pb-6">
          <h1 className="text-3xl font-bold text-gray-900">Historical Timeline</h1>
          <p className="text-sm text-gray-500 mt-1">
            Causal chains and overlapping periods leading to Israeli statehood
          </p>
        </div>

        <TimelineSection
          title="Holocaust and European Jewish Crisis"
          description="The impact of Nazi persecution on Jewish immigration to Palestine and international sympathy for Jewish statehood"
          color="orange"
          startYear={1910}
          endYear={2030}
          events={holocaustEvents}
          connections={holocaustConnections}
        />

        <TimelineSection
          title="UN Partition Resolution Process"
          description="United Nations deliberation, vote, and adoption of the resolution for the partition of Palestine"
          color="purple"
          startYear={1920}
          endYear={1970}
          events={partitionEvents}
          connections={partitionConnections}
        />

      </div>
    </div>
  );
}
