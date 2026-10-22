type Props = {
  projectName: string;
};

export default function Toolbar({ projectName }: Props) {
  return (
    <header className="toolbar">
      <div className="toolbar__brand">
        <span className="toolbar__mark" />
        <div>
          <h1>{projectName}</h1>
          <p>Cinematic color, dialogue cleanup and silence removal — rendered on your own device.</p>
        </div>
      </div>
    </header>
  );
}
