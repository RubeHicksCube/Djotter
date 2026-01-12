import { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { format } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { useUserSettings } from '../contexts/UserSettingsContext';
import { useCurrentDate } from '../contexts/CurrentDateContext';
import { formatLogTime, getTodayInUserTimezone } from '../utils/timezone';
import ContributionCalendar from '../components/ContributionCalendar';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const formatDate = (dateStr, timezone = 'UTC') => {
  const date = new Date(dateStr + 'T00:00:00'); // Ensure it's parsed as date-only
  return formatInTimeZone(date, timezone, 'yyyy-MMM-dd');
};

// Sortable wrapper component with drag handle
function SortableItem({ id, children }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <div
          ref={setActivatorNodeRef}
          {...listeners}
          style={{
            cursor: 'grab',
            padding: '0.25rem',
            display: 'flex',
            alignItems: 'center',
            fontSize: '1.2rem',
            color: 'var(--text-secondary)',
          }}
          title="Drag to reorder"
        >
          ⋮⋮
        </div>
        <div style={{ flex: 1 }}>
          {children}
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const { settings } = useUserSettings();
  const { setCurrentDate, isViewingHistoricalDate, setIsViewingHistoricalDate, resetToToday } = useCurrentDate();
  const [state, setState] = useState(null);
  const [entryText, setEntryText] = useState('');
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Template custom field form (persist name, reset value daily)
  const [templateFieldKey, setTemplateFieldKey] = useState('');
  const [templateFieldType, setTemplateFieldType] = useState('text');



  // Daily custom field form (non-persistent)
  const [dailyFieldKey, setDailyFieldKey] = useState('');

  // Debounce timer for template field updates
  const debounceTimers = useRef({});
  const [dailyFieldValue, setDailyFieldValue] = useState('');

  // Daily task form
  const [dailyTaskText, setDailyTaskText] = useState('');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [taskPoints, setTaskPoints] = useState(0);
  const [availableDates, setAvailableDates] = useState([]);
  const [taskDetails, setTaskDetails] = useState('');
  const [showTaskOptions, setShowTaskOptions] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [expandedTaskId, setExpandedTaskId] = useState(null);
  const [addingSubTaskTo, setAddingSubTaskTo] = useState(null);
  const [subTaskText, setSubTaskText] = useState('');
  const [allTasks, setAllTasks] = useState([]);

  // Entry editing state
  const [editingEntryId, setEditingEntryId] = useState(null);
  const [editEntryText, setEditEntryText] = useState('');

  // Image attachment
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);

  // Historical log query
  const [queryDate, setQueryDate] = useState('');
  const [queryText, setQueryText] = useState('');
  const [historicalLog, setHistoricalLog] = useState(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    loadState();
    loadAllTasks();
    loadAvailableDates();

    // Update time every second and check for date changes
    const timeInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timeInterval);
  }, []);

  // Auto-save snapshot when date changes or app loads
  useEffect(() => {
    const autoSaveSnapshot = async () => {
      if (!state?.date) return;

      try {
        // Check if we already have a snapshot for today
        const dates = availableDates || [];
        const hasSnapshotForToday = dates.includes(state.date);

        // Save snapshot if it doesn't exist for today
        if (!hasSnapshotForToday) {
          console.log('Auto-saving snapshot for', state.date);
          await api.saveSnapshot();
          loadAvailableDates(); // Refresh available dates
        }
      } catch (error) {
        console.error('Error auto-saving snapshot:', error);
      }
    };

    // Run auto-save when state loads or date changes
    if (state?.date && !isViewingHistoricalDate) {
      autoSaveSnapshot();
    }
  }, [state?.date, isViewingHistoricalDate]);

  // Reload state when timezone changes to get updated date
  useEffect(() => {
    if (settings.timezone && state) {
      console.log('Timezone changed to:', settings.timezone, 'reloading state...');
      loadState();
    }
  }, [settings.timezone]);

  // Reload state when page becomes visible again (after navigation or tab switch)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && !isViewingHistoricalDate) {
        console.log('Page became visible, reloading state...');
        loadState();
      }
    };

    const handleFocus = () => {
      if (!isViewingHistoricalDate) {
        console.log('Page gained focus, reloading state...');
        loadState();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [isViewingHistoricalDate]);

  // Reload state when custom fields might change (to refresh entries)
  useEffect(() => {
    if (state) {
      console.log('State loaded, monitoring for entry changes...');
    }
  }, []);

  // Also watch for custom field changes and refresh state if needed
  useEffect(() => {
    // This will trigger when custom fields are updated
    const hasCustomFields = state && state.customFields && state.customFields.length > 0;
    if (hasCustomFields) {
      console.log('Custom fields detected, setting up state refresh watcher...');
      // We could add more sophisticated logic here if needed
    }
  }, [state?.customFields]);

  const loadAvailableDates = async () => {
    try {
      const response = await api.getAvailableExportDates();
      setAvailableDates(response.dates || []);
    } catch (error) {
      console.error('Error loading available dates:', error);
    }
  };

  const loadState = async () => {
    try {
      const data = await api.getState();
      setState(data);
      setLoading(false);
    } catch (error) {
      console.error('Error loading state:', error);
      setLoading(false);
    }
  };

  const loadHistoricalState = async (date) => {
    try {
      setLoading(true);
      const data = await api.getStateForDate(date);
      setState(data);
      setIsViewingHistoricalDate(true);
      setCurrentDate(date); // Update context
      setLoading(false);
    } catch (error) {
      console.error('Error loading historical state:', error);
      setLoading(false);
    }
  };

  const handleGoToToday = () => {
    setIsViewingHistoricalDate(false);
    resetToToday(); // Reset context
    loadState();
  };

  const handleLoadDate = () => {
    if (!queryDate) return;

    // Check if selected date is today
    const today = getTodayInUserTimezone(settings?.timezone || 'UTC');
    if (queryDate === today) {
      handleGoToToday();
      return;
    }

    loadHistoricalState(queryDate);
  };

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Check file size (20MB limit)
    if (file.size > 20 * 1024 * 1024) {
      alert('Image size must be under 20MB');
      return;
    }

    // Check file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    // Convert to base64
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result;
      setSelectedImage(base64String);
      setImagePreview(base64String);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
  };

  const handleSubmitEntry = async (e) => {
    e.preventDefault();
    if (!entryText.trim()) return;

    try {
      const data = await api.addEntry(entryText, selectedImage, state.date);
      setState(data);
      setEntryText('');
      setSelectedImage(null);
      setImagePreview(null);
      // Reset file input
      const fileInput = document.getElementById('entry-image-input');
      if (fileInput) fileInput.value = '';
    } catch (error) {
      console.error('Error adding entry:', error);
      alert(error.message || 'Error adding entry');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmitEntry(e);
    }
  };

  const handleCreateTemplateField = async (e) => {
    e.preventDefault();
    if (!templateFieldKey.trim()) return;

    try {
      const response = await api.createCustomFieldTemplate(templateFieldKey, templateFieldType);
      setState(response.state);
      setTemplateFieldKey('');
      setTemplateFieldType('text');
    } catch (error) {
      console.error('Error creating template field:', error);
    }
  };

  const handleUpdateTemplateFieldValue = (key, value) => {
    // Handle notes field separately
    if (key.endsWith('_notes')) {
      const actualKey = key.replace('_notes', '');
      setState(prev => ({
        ...prev,
        customFields: prev.customFields.map(f =>
          f.key === actualKey ? { ...f, notes: value } : f
        )
      }));
      
      // Debounce API call for notes
      if (debounceTimers.current[key]) {
        clearTimeout(debounceTimers.current[key]);
      }
      debounceTimers.current[key] = setTimeout(async () => {
        try {
          await api.updateCustomFieldValue(actualKey, { notes: value, date: state.date });
        } catch (error) {
          console.error('Error updating field notes:', error);
        }
      }, 1000);
      
    } else if (key === 'worked_out' && typeof value === 'boolean') {
      // Handle worked_out checkbox specifically for workout-related fields
      setState(prev => ({
        ...prev,
        customFields: prev.customFields.map(f =>
          (f.key.toLowerCase().includes('workout') || f.key.toLowerCase().includes('exercise') || f.key.toLowerCase().includes('training')) 
            ? { ...f, worked_out: value } : f
        )
      }));
      
      // Create a log entry when boolean field changes
      const logText = `${key} ${value ? 'checked' : 'unchecked'}`;
      api.addEntry(logText, null, state.date).then(() => {
        // Reload the current date being viewed
        if (isViewingHistoricalDate) {
          loadHistoricalState(state.date);
        } else {
          loadState();
        }
      }).catch(error => {
        console.error('Error logging boolean field change:', error);
      });
      
    } else {
      // Handle regular field values (including boolean fields)
      const field = state.customFields.find(f => f.key === key);
      const isBooleanField = field?.field_type === 'boolean' || typeof value === 'boolean';
      
      setState(prev => ({
        ...prev,
        customFields: prev.customFields.map(f =>
          f.key === key ? { ...f, value: isBooleanField ? value : value } : f
        )
      }));

      if (isBooleanField) {
        // For boolean fields, save the value first, then reload state
        api.updateCustomFieldValue(key, { value, date: state.date }).then(() => {
          if (isViewingHistoricalDate) {
            loadHistoricalState(state.date);
          } else {
            loadState();
          }
        }).catch(error => {
          console.error('Error updating boolean field:', error);
        });
      } else {
        // For non-boolean fields, debounce API call
        if (debounceTimers.current[key]) {
          clearTimeout(debounceTimers.current[key]);
        }
        debounceTimers.current[key] = setTimeout(async () => {
          try {
            await api.updateCustomFieldValue(key, { value, date: state.date });
          } catch (error) {
            console.error('Error updating field value:', error);
          }
        }, 1000);
      }
    }
  };

  const handleDeleteTemplateField = async (id) => {
    try {
      const response = await api.deleteCustomFieldTemplate(id);
      setState(response.state);
    } catch (error) {
      console.error('Error deleting template field:', error);
    }
  };



  const handleAddDailyCustomField = async (e) => {
    e.preventDefault();
    if (!dailyFieldKey.trim() || !dailyFieldValue.trim()) return;

    try {
      const data = await api.addDailyCustomField(dailyFieldKey, dailyFieldValue);
      setState(data);
      setDailyFieldKey('');
      setDailyFieldValue('');
    } catch (error) {
      console.error('Error adding daily custom field:', error);
    }
  };

  const handleDeleteDailyCustomField = async (id) => {
    try {
      const data = await api.deleteDailyCustomField(id);
      setState(data);
    } catch (error) {
      console.error('Error deleting daily custom field:', error);
    }
  };

  const handleAddDailyTask = async (e) => {
    if (e) e.preventDefault();
    if (!dailyTaskText.trim()) return;

    try {
      const currentDate = getTodayInUserTimezone(settings?.timezone || 'UTC');
      await api.addDailyTask(
        dailyTaskText,
        taskDueDate || currentDate,
        taskDetails,
        null, // parentTaskId
        taskPoints || 0
      );
      await loadAllTasks();
      // Reload state to update activity log
      const freshState = await api.getState();
      setState(freshState);
      setDailyTaskText('');
      setTaskDueDate('');
      setTaskDetails('');
      setTaskPoints(0);
      setShowTaskOptions(false);
    } catch (error) {
      console.error('Error adding daily task:', error);
    }
  };

  const handleTaskKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAddDailyTask();
    }
  };

  const loadAllTasks = async () => {
    try {
      // Get all tasks (not filtered by date)
      const response = await api.getAllTasks();
      let tasks = response.tasks || [];

      // Filter out completed tasks that were completed before today
      const today = getTodayInUserTimezone(settings?.timezone || 'UTC');
      tasks = tasks.filter(task => {
        if (!task.done) return true; // Keep all incomplete tasks
        if (!task.completedAt) return true; // Keep if no completion date
        const completedDate = task.completedAt.slice(0, 10);
        return completedDate === today; // Only keep tasks completed today
      });

      // Sort: incomplete tasks first, then completed tasks
      // Within each group, respect the order_index from drag-and-drop
      tasks.sort((a, b) => {
        if (a.done !== b.done) {
          return a.done ? 1 : -1; // Incomplete (done=false) first, completed (done=true) last
        }
        // Same completion status - sort by order_index if available
        if (a.orderIndex !== undefined && b.orderIndex !== undefined) {
          return a.orderIndex - b.orderIndex;
        }
        return 0;
      });

      setAllTasks(tasks);
    } catch (error) {
      console.error('Error loading all tasks:', error);
    }
  };

  const handleAddSubTask = async (parentTaskId) => {
    if (!subTaskText.trim()) return;

    try {
      const currentDate = getTodayInUserTimezone(settings?.timezone || 'UTC');
      await api.addDailyTask(
        subTaskText,
        currentDate,
        null, // details
        parentTaskId
      );
      await loadAllTasks();
      // Reload state to update activity log
      const freshState = await api.getState();
      setState(freshState);
      setSubTaskText('');
      setAddingSubTaskTo(null);
    } catch (error) {
      console.error('Error adding sub-task:', error);
    }
  };

  const handleUpdateTask = async (id) => {
    const task = allTasks.find(t => t.id === id);
    if (!task) return;

    try {
      await api.updateDailyTask(id, {
        text: task.text,
        dueDate: task.dueDate,
        details: task.details,
        pinned: task.pinned,
        recurring: task.recurring
      });
      await loadAllTasks();
      // Reload state to update activity log
      const freshState = await api.getState();
      setState(freshState);
      setEditingTaskId(null);
    } catch (error) {
      console.error('Error updating task:', error);
    }
  };

  const handleToggleTaskPinned = async (id) => {
    try {
      await api.toggleTaskPinned(id);
      await loadAllTasks();
      // Reload state to update activity log
      const freshState = await api.getState();
      setState(freshState);
    } catch (error) {
      console.error('Error toggling task pinned:', error);
    }
  };

  const handleToggleTaskRecurring = async (id) => {
    try {
      await api.toggleTaskRecurring(id);
      await loadAllTasks();
      // Reload state to update activity log
      const freshState = await api.getState();
      setState(freshState);
    } catch (error) {
      console.error('Error toggling task recurring:', error);
    }
  };

  const handleToggleDailyTask = async (id) => {
    try {
      await api.toggleDailyTask(id);
      await loadAllTasks();
      // Reload state to update activity log
      const freshState = await api.getState();
      setState(freshState);
    } catch (error) {
      console.error('Error toggling daily task:', error);
    }
  };

  const handleDeleteDailyTask = async (id) => {
    try {
      await api.deleteDailyTask(id);
      await loadAllTasks();
      // Reload state to update activity log
      const freshState = await api.getState();
      setState(freshState);
    } catch (error) {
      console.error('Error deleting daily task:', error);
    }
  };

  const viewTaskLog = (logEntryId) => {
    if (!logEntryId) return;
    // Find the log entry in state.entries
    const entry = state.entries.find(e => e.id === logEntryId);
    if (entry) {
      // Scroll to the entry
      const entryElement = document.getElementById(`entry-${logEntryId}`);
      if (entryElement) {
        entryElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        entryElement.style.backgroundColor = 'rgba(139, 92, 246, 0.2)';
        setTimeout(() => {
          entryElement.style.backgroundColor = '';
        }, 2000);
      }
    }
  };

  const handleEditEntry = (entry) => {
    setEditingEntryId(entry.id);
    setEditEntryText(entry.text);
  };

  const handleUpdateEntry = async (id) => {
    try {
      const data = await api.updateEntry(id, editEntryText);
      setState(data);
      setEditingEntryId(null);
      setEditEntryText('');
    } catch (error) {
      console.error('Error updating entry:', error);
    }
  };

  const handleCancelEditEntry = () => {
    setEditingEntryId(null);
    setEditEntryText('');
  };

  const handleDeleteEntry = async (id) => {
    try {
      const data = await api.deleteEntry(id);
      setState(data);
    } catch (error) {
      console.error('Error deleting entry:', error);
    }
  };

  // Query historical log
  // Add state to track when we should auto-submit after date changes
  const [shouldAutoSubmit, setShouldAutoSubmit] = useState(false);

  // Watch for changes to queryDate and auto-submit if needed
  useEffect(() => {
    if (shouldAutoSubmit && queryDate && !queryText.trim()) {
      setShouldAutoSubmit(false); // Reset the flag
      setTimeout(() => {
        handleQueryHistory({ preventDefault: () => {} });
      }, 50);
    }
  }, [queryDate, shouldAutoSubmit]);

  const handleCalendarDateClick = (dateStr) => {
    // Set the date in search form
    setQueryDate(dateStr);
    setQueryText(''); // Clear text search
    setShouldAutoSubmit(true); // Set flag to auto-submit after React updates
  };

  const handleExportSnapshot = async () => {
    if (!historicalLog || !historicalLog.date) return;
    
    try {
      // Use date range download for single day snapshot
      await api.downloadDateRange(historicalLog.date, historicalLog.date);
      alert(`Snapshot for ${formatDate(historicalLog.date)} exported successfully!`);
    } catch (error) {
      console.error('Error exporting snapshot:', error);
      alert('Failed to export snapshot. Please try again.');
    }
  };

  const handleQueryHistory = async (e) => {
    e.preventDefault();

    // Require either text or date
    if (!queryText.trim() && !queryDate) {
      alert('Please enter search text or select a date');
      return;
    }

    setIsLoadingHistory(true);
    try {
      if (queryText.trim()) {
        // Text search is primary - search for individual entries
        const result = await api.searchEntries(queryText, queryDate || null);
        setHistoricalLog({
          entries: result.entries,
          searchMode: 'entries',
          searchText: queryText,
          searchDate: queryDate
        });
      } else {
        // Date-only search - try snapshot first, fallback to database state
        try {
          const result = await api.getSnapshot(queryDate);
          const snapshot = result.snapshot;
          setHistoricalLog({
            ...snapshot,
            entries: snapshot.entries || [],
            date: queryDate,
            searchMode: 'snapshot'
          });
        } catch (snapshotError) {
          // Snapshot not found, load from database instead
          console.log('No snapshot found, loading from database...', snapshotError);
          const result = await api.getStateForDate(queryDate);
          setHistoricalLog({
            ...result,
            entries: result.entries || [],
            date: queryDate,
            searchMode: 'database'
          });
        }
      }
    } catch (error) {
      console.error('Error querying history:', error);
      alert(error.message || 'No results found');
      setHistoricalLog(null);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Drag and drop handlers
  const handleDragEnd = async (event, listType) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    let items, reorderFn;

    switch (listType) {
      case 'customFields':
        items = state.customFields;
        reorderFn = api.reorderCustomFieldTemplates;
        break;
      case 'dailyCustomFields':
        items = state.dailyCustomFields;
        reorderFn = api.reorderDailyCustomFields;
        break;
      case 'dailyTasks':
        items = state.dailyTasks;
        reorderFn = api.reorderDailyTasks;
        break;
      case 'allTasks':
        items = allTasks;
        reorderFn = api.reorderDailyTasks;
        break;
      case 'entries':
        items = state.entries;
        reorderFn = api.reorderActivityEntries;
        break;
      default:
        return;
    }

    const oldIndex = items.findIndex((item) => item.id === active.id);
    const newIndex = items.findIndex((item) => item.id === over.id);

    const newItems = arrayMove(items, oldIndex, newIndex);

    // Update local state immediately
    if (listType === 'allTasks') {
      setAllTasks(newItems);
    } else {
      setState(prev => ({
        ...prev,
        [listType === 'customFields' ? 'customFields' : listType]: newItems
      }));
    }

    // Send reorder to backend
    try {
      await reorderFn(newItems.map((item, index) => ({ id: item.id, order_index: index })));
    } catch (error) {
      console.error(`Error reordering ${listType}:`, error);
      // Reload state on error
      if (listType === 'allTasks') {
        loadAllTasks();
      } else {
        loadState();
      }
    }
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (!state) {
    return <div className="loading">Error loading application data. Please refresh the page or contact support.</div>;
  }

  return (
    <div className="container" style={{ position: 'relative' }}>
      <header>
        <div className="date-header" style={{ position: 'relative', overflow: 'visible' }}>
          <h1 className="date-large">{state.date ? formatDate(state.date, settings.timezone) : 'Loading...'}</h1>
          <p className="time-large">{formatInTimeZone(currentTime, settings.timezone, 'HH:mm:ss')}</p>
        </div>
      </header>

      <div className="home-grid-layout">
        <div className="card card-primary">
          <h2>🔍 Daily Data</h2>
          <p className="card-description">Search logs by text or view snapshots by date</p>
          
          {/* Calendar Section - Always Visible */}
          {/* Calendar Toggle */}
          <div style={{ marginTop: '0.5rem', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => setShowCalendar(!showCalendar)}
                className={`btn btn-sm ${showCalendar ? 'btn-primary' : 'btn-ghost'}`}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                📅 Calendar {showCalendar ? '▲' : '▼'}
              </button>
            </div>

            {/* Expanding Calendar Section */}
            {showCalendar && (
              <div style={{
                marginTop: '1rem',
                padding: '1rem',
                backgroundColor: 'var(--bg-secondary)',
                borderRadius: '8px',
                border: '1px solid var(--border-color)'
              }}>
                <ContributionCalendar
                  availableDates={availableDates || []}
                  formatDateDisplay={formatDate}
                  compact={true}
                  onDateClick={handleCalendarDateClick}
                />
              </div>
            )}
          </div>

          <form onSubmit={handleQueryHistory}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Search Text</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Search all entries..."
                  value={queryText}
                  onChange={(e) => setQueryText(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Date (optional)</label>
                <input
                  type="date"
                  className="form-input"
                  value={queryDate}
                  onChange={(e) => setQueryDate(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              {isViewingHistoricalDate && (
                <button
                  type="button"
                  onClick={handleGoToToday}
                  className="btn btn-primary"
                  style={{ fontWeight: 'bold' }}
                >
                  ← Back to Today
                </button>
              )}
              <button type="submit" className="btn btn-primary" disabled={isLoadingHistory}>
                {isLoadingHistory ? 'Searching...' : '🔍 Search'}
              </button>
              {queryDate && (
                <button
                  type="button"
                  onClick={handleLoadDate}
                  className="btn btn-secondary"
                  title="Load this date's full state"
                >
                  📅 Load Date
                </button>
              )}
            </div>
          </form>

          {/* Search Results Display */}
          {historicalLog && (
            <div style={{ marginTop: '2rem', paddingTop: '2rem', borderTop: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <h3 style={{ fontSize: '1.125rem', margin: 0 }}>
                  {historicalLog.searchMode === 'entries' ? '📜 Search Results' : `📜 Snapshot - ${formatDate(historicalLog.date)}`}
                </h3>
                {historicalLog.searchMode !== 'entries' && (
                  <button
                    onClick={handleExportSnapshot}
                    className="btn btn-sm btn-success"
                    type="button"
                    title="Export this snapshot to various formats"
                  >
                    📥 Export Snapshot
                  </button>
                )}
              </div>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                {historicalLog.searchMode === 'entries'
                  ? `Found ${historicalLog.entries.length} matching ${historicalLog.entries.length === 1 ? 'entry' : 'entries'}${historicalLog.searchDate ? ` on ${formatDate(historicalLog.searchDate)}` : ' across all dates'}`
                  : `Full snapshot for ${formatDate(historicalLog.date)}`
                }
              </p>

              {/* Daily Tasks - only show in snapshot mode */}
              {historicalLog.searchMode !== 'entries' && historicalLog.dailyTasks && historicalLog.dailyTasks.length > 0 && (
                <>
                  <h4 style={{ marginTop: '1.5rem', marginBottom: '1rem', fontSize: '1rem' }}>
                    Daily Tasks ({historicalLog.dailyTasks.length})
                  </h4>
                  <div className="tasks-list">
                    {historicalLog.dailyTasks.map((task, index) => (
                      <div key={index} className="task-item">
                        <input
                          type="checkbox"
                          checked={task.done}
                          disabled
                          style={{ marginRight: '0.5rem' }}
                        />
                        <span style={{ textDecoration: task.done ? 'line-through' : 'none' }}>
                          {task.text}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Custom Fields - only show in snapshot mode */}
              {historicalLog.searchMode !== 'entries' && historicalLog.customFields && historicalLog.customFields.length > 0 && (
                <>
                  <h4 style={{ marginTop: '1.5rem', marginBottom: '1rem', fontSize: '1rem' }}>
                    Custom Fields ({historicalLog.customFields.length})
                  </h4>
                  <div className="fields-list">
                    {historicalLog.customFields.map((field, index) => (
                      <div key={index} style={{ marginBottom: '0.5rem' }}>
                        <strong>{field.key}:</strong> {field.value || '(empty)'}
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Daily Custom Fields - only show in snapshot mode */}
              {historicalLog.searchMode !== 'entries' && historicalLog.dailyCustomFields && historicalLog.dailyCustomFields.length > 0 && (
                <>
                  <h4 style={{ marginTop: '1.5rem', marginBottom: '1rem', fontSize: '1rem' }}>
                    Daily Custom Fields ({historicalLog.dailyCustomFields.length})
                  </h4>
                  <div className="fields-list">
                    {historicalLog.dailyCustomFields.map((field, index) => (
                      <div key={index} style={{ marginBottom: '0.5rem' }}>
                        <strong>{field.key}:</strong> {field.value}
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Activity Entries */}
              {historicalLog.entries && historicalLog.entries.length > 0 ? (
                <>
                  <h4 style={{ marginTop: '1.5rem', marginBottom: '1rem', fontSize: '1rem' }}>
                    {historicalLog.searchMode === 'entries' ? 'Matching Entries' : 'Activity Entries'} ({historicalLog.entries.length})
                  </h4>
                  <div className="entries-list">
                    {historicalLog.entries.map((entry, index) => (
                      <div key={index} className="entry-item">
                        <div className="entry-content">
                          {historicalLog.searchMode === 'entries' && entry.date && (
                            <span style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)', marginRight: '0.5rem' }}>
                              {formatDate(entry.date)}
                            </span>
                          )}
                          <span className="entry-time">{formatLogTime(entry.timestamp, settings.timezone)}</span>
                          <span className="entry-text">{entry.text}</span>
                          {entry.image && (
                            <div className="entry-image">
                              <img src={entry.image} alt="Entry attachment" />
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : historicalLog && (
                <p style={{ marginTop: '1.5rem', fontStyle: 'italic', color: 'var(--text-tertiary)' }}>
                  {historicalLog.searchMode === 'entries' ? 'No entries match your search.' : 'No activity entries for this date.'}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="card card-primary">
          <h2>📋 Template Custom Fields</h2>
          <p className="card-description">Create fields that persist daily - values reset each day</p>

          <form onSubmit={handleCreateTemplateField} style={{ marginBottom: '1rem' }}>
            <input
              type="text"
              className="form-input"
              placeholder="Field name (e.g., Mood, Energy Level)"
              value={templateFieldKey}
              onChange={(e) => setTemplateFieldKey(e.target.value)}
              style={{ marginBottom: '0.5rem' }}
            />
            <div className="custom-field-form">
              <select
                className="form-input"
                value={templateFieldType}
                onChange={(e) => setTemplateFieldType(e.target.value)}
              >
                <option value="text">Text</option>
                <option value="number">Number</option>
                <option value="currency">Currency ($)</option>
                <option value="date">Date</option>
                <option value="time">Time</option>
                <option value="datetime">Date & Time</option>
                <option value="boolean">Checkbox</option>
              </select>
              <button type="submit" className="btn btn-sm btn-primary">Create Template</button>
            </div>
          </form>

          {state.customFields && state.customFields.length > 0 && (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={(event) => handleDragEnd(event, 'customFields')}
            >
              <SortableContext
                items={state.customFields.map(f => f.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="custom-fields-list">
                  {state.customFields.map((field) => (
                    <SortableItem key={field.id} id={field.id}>
                      <div className="custom-field-item template-field">
                         <div className="field-content">
                           <span className="field-key">{field.key}:</span>
                           {field.field_type === 'currency' ? (
                             <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                               <span style={{ marginRight: '0.25rem', color: 'var(--text-secondary)' }}>$</span>
                               <input
                                 type="number"
                                 className="field-value-input"
                                 value={field.value}
                                 onChange={(e) => handleUpdateTemplateFieldValue(field.key, e.target.value)}
                                 placeholder="0.00"
                                 step="0.01"
                                 min="0"
                                 style={{ flex: 1 }}
                               />
                             </div>
                           ) : (
                             <>
                               {/* Worked Out Checkbox for relevant fields */}
                               {(field.key.toLowerCase().includes('workout') || field.key.toLowerCase().includes('exercise') || field.key.toLowerCase().includes('training')) && (
                                 <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem' }}>
                                   <input
                                     type="checkbox"
                                  checked={field.worked_out === true}
                                  onChange={(e) => handleUpdateTemplateFieldValue('worked_out', e.target.checked)}
                                     style={{ marginRight: '0.5rem' }}
                                   />
                                   <label style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                                     Worked Out
                                   </label>
                                 </div>
                               )}
                               
                                {/* Main Field Input */}
                                {field.field_type === 'boolean' ? (
                                  <input
                                    type="checkbox"
                                    checked={field.value === true || field.value === 'true'}
                                    onChange={(e) => handleUpdateTemplateFieldValue(field.key, e.target.checked)}
                                  />
                                ) : (
                                  <input
                                    type={
                                      field.field_type === 'number' ? 'number' :
                                      field.field_type === 'date' ? 'date' :
                                      field.field_type === 'time' ? 'time' :
                                      field.field_type === 'datetime' ? 'datetime-local' :
                                      'text'
                                    }
                                    className="field-value-input"
                                    value={field.value || ''}
                                    onChange={(e) => handleUpdateTemplateFieldValue(field.key, e.target.value)}
                                    placeholder={
                                      field.field_type === 'number' ? 'Enter number' :
                                      field.field_type === 'date' ? 'Select date' :
                                      field.field_type === 'time' ? 'Select time' :
                                      field.field_type === 'datetime' ? 'Select date & time' :
                                      'Enter value'
                                    }
                                    step={field.field_type === 'number' ? 'any' : undefined}
                                  />
                                )}
                             </>
                           )}
                         </div>
                        <button
                          onClick={() => handleDeleteTemplateField(field.id)}
                          className="btn-icon btn-icon-sm btn-danger"
                          title="Delete template"
                        >
                          ×
                        </button>

                      </div>
                    </SortableItem>
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>

        <div className="card card-warning">
          <h2>✓ Add Task</h2>
          <p className="card-description">Press Enter to add, Shift+Enter for new lines</p>

          <form onSubmit={handleAddDailyTask}>
            <textarea
              value={dailyTaskText}
              onChange={(e) => setDailyTaskText(e.target.value)}
              onKeyDown={handleTaskKeyDown}
              placeholder="What needs to be done?"
              rows="2"
              className="form-textarea"
              style={{ marginBottom: '0.5rem' }}
            />

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setShowTaskOptions(!showTaskOptions)}
                className="btn btn-sm btn-ghost"
                style={{ padding: '0.25rem 0.5rem' }}
              >
                {showTaskOptions ? '▲' : '▼'} More Options
              </button>
            </div>

            {showTaskOptions && (
              <div style={{ marginBottom: '0.5rem', padding: '1rem', backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                  <label className="form-label">Details (optional)</label>
                  <textarea
                    value={taskDetails}
                    onChange={(e) => setTaskDetails(e.target.value)}
                    className="form-textarea"
                    placeholder="Add task details... (creates a log entry)"
                    rows="2"
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                  <label className="form-label">Due Date</label>
                  <input
                    type="date"
                    value={taskDueDate}
                    onChange={(e) => setTaskDueDate(e.target.value)}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Points (optional)</label>
                  <input
                    type="number"
                    value={taskPoints}
                    onChange={(e) => setTaskPoints(parseInt(e.target.value) || 0)}
                    className="form-input"
                    placeholder="0"
                    min="0"
                    step="1"
                  />
                  <small style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                    Assign points to track task value
                  </small>
                </div>
              </div>
            )}

            <button type="submit" className="btn btn-warning">Add Task</button>
          </form>
        </div>

        {/* All Tasks Display */}
        <div className="card card-primary activity-entry-card">
          <h2>✓ Tasks</h2>
          <p className="card-description">All your tasks in one place</p>

          {allTasks && allTasks.length > 0 ? (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={(event) => handleDragEnd(event, 'allTasks')}
            >
              <SortableContext
                items={allTasks.map(t => t.id)}
                strategy={verticalListSortingStrategy}
              >
                 <div className="tasks-list">
                   {allTasks.map((task) => (
                     <SortableItem key={task.id} id={task.id}>
                       <div style={{
                         marginBottom: '0.75rem',
                         border: '1px solid var(--border-color)',
                         borderRadius: 'var(--radius-md)',
                         padding: '0.75rem',
                         backgroundColor: task.isReward
                           ? 'linear-gradient(135deg, rgba(255, 215, 0, 0.15), rgba(34, 197, 94, 0.15))'
                           : task.pinned ? 'var(--bg-secondary)' : 'var(--bg-tertiary)',
                         borderLeft: task.isReward
                           ? '4px solid gold'
                           : task.pinned ? '3px solid var(--primary-color)' : '1px solid var(--border-color)',
                         boxShadow: task.isReward ? '0 2px 8px rgba(255, 215, 0, 0.3)' : 'none'
                       }}>
                         <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                           {task.pinned && (
                             <span style={{ 
                               marginRight: '0.25rem', 
                               color: 'var(--primary-color)', 
                               fontSize: '1rem',
                               marginTop: '0.1rem'
                             }} title="Pinned task">
                               📌
                             </span>
                           )}
                           <input
                             type="checkbox"
                             checked={task.done}
                             onChange={() => handleToggleDailyTask(task.id)}
                             style={{ marginTop: '0.25rem' }}
                           />

                          <div style={{ flex: 1 }}>
                            {editingTaskId === task.id ? (
                              <div>
                                <input
                                  type="text"
                                  value={task.text}
                                  onChange={(e) => setAllTasks(prev =>
                                    prev.map(t =>
                                      t.id === task.id ? { ...t, text: e.target.value } : t
                                    )
                                  )}
                                  className="form-input"
                                  style={{ marginBottom: '0.5rem' }}
                                />
                                <textarea
                                  value={task.details || ''}
                                  onChange={(e) => setAllTasks(prev =>
                                    prev.map(t =>
                                      t.id === task.id ? { ...t, details: e.target.value } : t
                                    )
                                  )}
                                  className="form-textarea"
                                  placeholder="Task details..."
                                  rows="2"
                                  style={{ marginBottom: '0.5rem' }}
                                />
                                <input
                                  type="date"
                                  value={task.dueDate || ''}
                                  onChange={(e) => setAllTasks(prev =>
                                    prev.map(t =>
                                      t.id === task.id ? { ...t, dueDate: e.target.value } : t
                                    )
                                  )}
                                  className="form-input"
                                  style={{ marginBottom: '0.5rem' }}
                                />
                                <input
                                  type="number"
                                  value={task.points || 0}
                                  onChange={(e) => setAllTasks(prev =>
                                    prev.map(t =>
                                      t.id === task.id ? { ...t, points: parseInt(e.target.value) || 0 } : t
                                    )
                                  )}
                                  className="form-input"
                                  placeholder="Points"
                                  min="0"
                                  step="1"
                                  style={{ marginBottom: '0.5rem' }}
                                />
                              </div>
                            ) : (
                              <div>
                                <span style={{
                                  textDecoration: task.done ? 'line-through' : 'none',
                                  fontWeight: '500',
                                  cursor: 'pointer'
                                }}
                                onClick={() => setExpandedTaskId(expandedTaskId === task.id ? null : task.id)}
                                >
                                  {expandedTaskId === task.id ? '▼' : '▶'} {task.text}
                                  {task.subTasks && task.subTasks.length > 0 && (
                                    <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                                      ({task.subTasks.filter(st => st.done).length}/{task.subTasks.length})
                                    </span>
                                  )}
                                </span>
                                {task.dueDate && (
                                  <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                                    📅 {formatDate(task.dueDate)}
                                  </span>
                                )}
                                {task.points > 0 && (
                                  <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', color: 'var(--primary-color)', fontWeight: 'bold' }}>
                                    ⭐ {task.points} pts
                                  </span>
                                )}
                                 {task.logEntryId && (
                                   <button
                                     onClick={() => viewTaskLog(task.logEntryId)}
                                     className="btn btn-sm btn-ghost"
                                     style={{ marginLeft: '0.5rem', padding: '0.125rem 0.5rem', fontSize: '0.75rem' }}
                                   >
                                     📝 View Log
                                   </button>
                                 )}

                              </div>
                            )}

                            {/* Expanded details */}
                            {expandedTaskId === task.id && (
                              <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                                {task.details && (
                                  <div style={{ marginBottom: '0.5rem', fontStyle: 'italic' }}>
                                    {task.details}
                                  </div>
                                )}

                                {/* Sub-tasks */}
                                {task.subTasks && task.subTasks.length > 0 && (
                                  <div style={{ marginTop: '0.5rem', marginLeft: '1rem' }}>
                                    <strong style={{ fontSize: '0.75rem' }}>Sub-tasks:</strong>
                                    {task.subTasks.map(subTask => (
                                      <div key={subTask.id} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.25rem' }}>
                                        <input
                                          type="checkbox"
                                          checked={subTask.done}
                                          onChange={() => handleToggleDailyTask(subTask.id)}
                                          style={{ transform: 'scale(0.9)' }}
                                        />
                                        <span style={{
                                          textDecoration: subTask.done ? 'line-through' : 'none',
                                          fontSize: '0.8125rem'
                                        }}>
                                          {subTask.text}
                                        </span>
                                        <button
                                          onClick={() => handleDeleteDailyTask(subTask.id)}
                                          className="btn-icon btn-icon-sm btn-danger"
                                          style={{ marginLeft: 'auto', fontSize: '0.75rem', width: '1.5rem', height: '1.5rem' }}
                                        >
                                          ×
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {/* Add sub-task */}
                                {addingSubTaskTo === task.id ? (
                                  <div style={{ marginTop: '0.5rem', marginLeft: '1rem' }}>
                                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                                      <input
                                        type="text"
                                        value={subTaskText}
                                        onChange={(e) => setSubTaskText(e.target.value)}
                                        placeholder="Sub-task..."
                                        className="form-input"
                                        style={{ fontSize: '0.8125rem' }}
                                      />
                                      <button
                                        onClick={() => handleAddSubTask(task.id)}
                                        className="btn btn-sm btn-success"
                                      >
                                        Add
                                      </button>
                                      <button
                                        onClick={() => setAddingSubTaskTo(null)}
                                        className="btn btn-sm btn-ghost"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => setAddingSubTaskTo(task.id)}
                                    className="btn btn-sm btn-ghost"
                                    style={{ marginTop: '0.5rem', fontSize: '0.75rem', padding: '0.125rem 0.5rem' }}
                                  >
                                    + Add Sub-task
                                  </button>
                                )}
                              </div>
                            )}
                          </div>

                          <div style={{ display: 'flex', gap: '0.25rem' }}>
                             {editingTaskId === task.id ? (
                               <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                 <button
                                   onClick={() => handleUpdateTask(task.id)}
                                   className="btn btn-sm btn-success"
                                   style={{ fontSize: '0.75rem' }}
                                 >
                                   Save
                                 </button>
                                 <div style={{ display: 'flex', gap: '0.25rem' }}>
                                   <button
                                     onClick={() => handleToggleTaskPinned(task.id)}
                                     className={`btn btn-sm ${task.pinned ? 'btn-warning' : 'btn-ghost'}`}
                                     style={{ fontSize: '0.75rem' }}
                                     title={task.pinned ? 'Unpin task' : 'Pin task'}
                                   >
                                     {task.pinned ? '📌 Unpin' : '📌 Pin'}
                                   </button>
                                   <button
                                     onClick={() => handleToggleTaskRecurring(task.id)}
                                     className={`btn btn-sm ${task.recurring ? 'btn-success' : 'btn-ghost'}`}
                                     style={{ fontSize: '0.75rem' }}
                                     title={task.recurring ? 'Remove recurring' : 'Set as recurring'}
                                   >
                                     {task.recurring ? '🔄 Remove recurring' : '🔄 Set as recurring'}
                                   </button>
                                 </div>
                               </div>
                             ) : (
                               <div style={{ display: 'flex', gap: '0.25rem' }}>
                                 <button
                                   onClick={() => setEditingTaskId(task.id)}
                                   className="btn-icon btn-icon-sm btn-secondary"
                                   title="Edit task"
                                 >
                                   ✎
                                 </button>
                                 <button
                                   onClick={() => handleToggleTaskPinned(task.id)}
                                   className={`btn-icon btn-icon-sm ${task.pinned ? 'btn-warning' : 'btn-secondary'}`}
                                   title={task.pinned ? 'Unpin task' : 'Pin task'}
                                 >
                                   {task.pinned ? '📌' : '📌'}
                                 </button>
                               </div>
                             )}
                            <button
                              onClick={() => handleDeleteDailyTask(task.id)}
                              className="btn-icon btn-icon-sm btn-danger"
                              title="Delete task"
                            >
                              ×
                            </button>
                          </div>
                        </div>
                      </div>
                    </SortableItem>
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          ) : (
            <div className="empty-state">
              No tasks yet. Create your first task above!
            </div>
          )}
        </div>

        <div className="card card-primary activity-entry-card">
          <h2>📝 Today's Log</h2>
        <p className="card-description">Capture your thoughts throughout the day - entries refresh daily</p>
        <form onSubmit={handleSubmitEntry}>
          <textarea
            value={entryText}
            onChange={(e) => setEntryText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="What are your thoughts today?"
            rows="5"
            className="form-textarea"
          />

          {/* Image attachment */}
          <div className="image-attachment-section">
            <label htmlFor="entry-image-input" className="btn btn-sm btn-secondary">
              📷 Attach Image
            </label>
            <input
              id="entry-image-input"
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
              style={{ display: 'none' }}
            />
          </div>
            {imagePreview && (
              <div className="image-preview">
                <img src={imagePreview} alt="Preview" />
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  className="btn-icon btn-icon-sm btn-danger"
                  title="Remove image"
                >
                  ×
                </button>
              </div>
            )}

            <button type="submit" className="btn btn-primary">
              Submit Entry
            </button>
          </form>

          {state.entries && state.entries.length > 0 && (
            <>
              <hr style={{ margin: '2rem 0', border: 'none', borderTop: '1px solid var(--border-color)' }} />
              <h3 style={{ marginBottom: '1rem', fontSize: '1.125rem', color: 'var(--text-primary)' }}>
                Today's Entries ({state.entries.length})
              </h3>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={(event) => handleDragEnd(event, 'entries')}
              >
                <SortableContext
                  items={state.entries.map(e => e.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="entries-list">
                    {state.entries.map((entry) => (
                      <SortableItem key={entry.id} id={entry.id}>
                        <div className="entry-item" id={`entry-${entry.id}`} style={{ transition: 'background-color 0.3s ease' }}>
                          {editingEntryId === entry.id ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
                              <textarea
                                value={editEntryText}
                                onChange={(e) => setEditEntryText(e.target.value)}
                                className="form-textarea"
                                rows="3"
                                style={{ width: '100%' }}
                              />
                              <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button
                                  onClick={() => handleUpdateEntry(entry.id)}
                                  className="btn btn-sm btn-primary"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={handleCancelEditEntry}
                                  className="btn btn-sm btn-ghost"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="entry-content">
                                <span className="entry-time">{formatLogTime(entry.timestamp, settings.timezone)}</span>
                                <span className="entry-text">{entry.text}</span>
                                {entry.image && (
                                  <div className="entry-image">
                                    <img src={entry.image} alt="Entry attachment" />
                                  </div>
                                )}
                              </div>
                              <div style={{ display: 'flex', gap: '0.25rem' }}>
                                <button
                                  onClick={() => handleEditEntry(entry)}
                                  className="btn-icon btn-icon-sm btn-ghost"
                                  title="Edit entry"
                                >
                                  ✎
                                </button>
                                <button
                                  onClick={() => handleDeleteEntry(entry.id)}
                                  className="btn-icon btn-icon-sm btn-danger"
                                  title="Delete entry"
                                >
                                  ×
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </SortableItem>
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
