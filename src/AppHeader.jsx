import { ArrowLeft, CalendarDays, Download, Ellipsis, Moon, Sun, Zap } from "lucide-react";

export default function AppHeader({
  screen,
  theme,
  isMenuOpen,
  exportMonth,
  onExportMonthChange,
  onOpenToday,
  onOpenHistory,
  onBack,
  onToggleMenu,
  onToggleTheme,
  onExportMonth,
  onExportAll
}) {
  const isWorkout = screen.name === "workout";

  return (
    <header className="app-header">
      <div className="header-leading">
        {isWorkout ? (
          <button type="button" className="header-icon" onClick={onBack} aria-label="Back">
            <ArrowLeft size={20} />
          </button>
        ) : null}
        <button type="button" className="wordmark" onClick={onOpenToday} aria-label="Open Today">
          <Zap size={17} />
          <strong>fitness</strong>
        </button>
      </div>
      <div className="header-actions">
        {!isWorkout ? (
          <button type="button" className={`history-action ${screen.name === "history" ? "active" : ""}`} onClick={onOpenHistory}>
            <CalendarDays size={17} />
            History
          </button>
        ) : null}
        <div className="header-menu-wrap">
          <button type="button" className="header-icon" onClick={onToggleMenu} aria-expanded={isMenuOpen} aria-label="More options">
            <Ellipsis size={21} />
          </button>
          {isMenuOpen ? (
            <div className="header-menu" role="dialog" aria-label="App options">
              <button type="button" onClick={onToggleTheme}>
                {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
                {theme === "dark" ? "Light theme" : "Dark theme"}
              </button>
              <label>
                <span>Export month</span>
                <input type="month" value={exportMonth} onChange={(event) => onExportMonthChange(event.target.value)} />
              </label>
              <button type="button" onClick={onExportMonth} disabled={!exportMonth}>
                <Download size={17} />
                Export month
              </button>
              <button type="button" onClick={onExportAll}>
                <Download size={17} />
                Export all data
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
