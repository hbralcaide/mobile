import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Switch,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';

interface OperatingHours {
  [key: string]: {
    isOpen: boolean;
    openTime: string;
    closeTime: string;
  };
}

interface OperatingHoursModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (hours: OperatingHours) => void;
  initialHours?: OperatingHours;
  embedded?: boolean;
  disabled?: boolean;
}

const OperatingHoursModal: React.FC<OperatingHoursModalProps> = ({
  visible,
  onClose,
  onSave,
  initialHours,
  embedded = false,
  disabled = false,
}) => {
  const [operatingHours, setOperatingHours] = useState<OperatingHours>({});

  // Generate time options for dropdowns
  const generateTimeOptionsForRange = (startHour: number, endHour: number) => {
    const times: Array<{ value: string; label: string }> = [];
    for (let hour = startHour; hour <= endHour; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        const displayTime = new Date(`2000-01-01T${timeString}`).toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        });
        times.push({ value: timeString, label: displayTime });
      }
    }
    return times;
  };

  // AM: 00:00 - 11:30, PM: 12:00 - 23:30
  const timeOptionsAM = generateTimeOptionsForRange(0, 11);
  const timeOptionsPM = generateTimeOptionsForRange(12, 23);

  // Days of the week in order
  const daysOfWeek = [
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday'
  ];

  useEffect(() => {
    if (initialHours && Object.keys(initialHours).length > 0) {
      setOperatingHours(initialHours);
    } else {
      // Initialize with default hours (9:00 AM - 5:00 PM for weekdays, closed weekends)
      const defaultHours: OperatingHours = {};
      daysOfWeek.forEach((day, index) => {
        const isWeekend = index >= 5; // Saturday (5) and Sunday (6)
        defaultHours[day] = {
          isOpen: !isWeekend,
          openTime: '09:00',
          closeTime: '17:00',
        };
      });
      setOperatingHours(defaultHours);
    }
  }, [initialHours]);

  const handleToggleDay = (day: string) => {
    setOperatingHours(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        isOpen: !prev[day].isOpen,
      },
    }));
  };

  const handleTimeChange = (day: string, timeType: 'openTime' | 'closeTime', time: string) => {
    setOperatingHours(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        [timeType]: time,
      },
    }));
  };

  const handleSave = () => {
    onSave(operatingHours);
    // Close editing or modal in all modes
    onClose();
  };

  const formatTimeForDisplay = (time: string) => {
    return new Date(`2000-01-01T${time}`).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  // Auto-save when embedded (no manual save button needed)
  useEffect(() => {
    if (embedded && Object.keys(operatingHours).length > 0) {
      onSave(operatingHours);
    }
  }, [operatingHours, embedded, onSave]);

  const content = (
    <View
      style={[
        embedded ? styles.embeddedContainer : styles.modalContainer,
        disabled && embedded ? styles.embeddedDisabled : null,
      ]}
      pointerEvents={disabled ? 'none' : 'auto'}
    >
      {/* Header - show in both modes but different styling */}
      <View style={embedded ? styles.embeddedHeader : styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.title}>Set Standard Hours</Text>
          <Text style={styles.subtitle}>
            Configure the standard hours of operation for this location.
          </Text>
        </View>
        {!embedded && (
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Content */}
      <ScrollView
        style={embedded ? styles.embeddedContent : styles.content}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled={true}
        scrollEnabled={!disabled}
        keyboardShouldPersistTaps="handled"
      >
            {daysOfWeek.map((day) => (
              <View key={day} style={styles.dayRow}>
                <View style={styles.dayInfo}>
                  <Text style={styles.dayName}>{day}</Text>
                  <View style={styles.toggleContainer}>
                    <Text style={[
                      styles.toggleLabel,
                      { color: operatingHours[day]?.isOpen ? '#8B5CF6' : '#9CA3AF' }
                    ]}>
                      {operatingHours[day]?.isOpen ? 'Open' : 'Closed'}
                    </Text>
                    <Switch
                      value={operatingHours[day]?.isOpen || false}
                      onValueChange={() => handleToggleDay(day)}
                      trackColor={{ false: '#E5E7EB', true: '#DDD6FE' }}
                      thumbColor={operatingHours[day]?.isOpen ? '#8B5CF6' : '#9CA3AF'}
                      ios_backgroundColor="#E5E7EB"
                    />
                  </View>
                </View>

                {/* Time pickers - only show when day is open */}
                {operatingHours[day]?.isOpen && (
                  <View style={styles.timeContainer}>
                    <View style={styles.timePickerContainer}>
                      <Text style={styles.timeLabel}>From</Text>
                      <View style={styles.pickerWrapper}>
                        <Picker
                          selectedValue={operatingHours[day]?.openTime || '09:00'}
                          onValueChange={(value) => handleTimeChange(day, 'openTime', value)}
                          style={styles.picker}
                        >
                          {timeOptionsAM.map((time) => (
                            <Picker.Item
                              key={time.value}
                              label={time.label}
                              value={time.value}
                            />
                          ))}
                        </Picker>
                      </View>
                    </View>

                    <Text style={styles.toText}>TO</Text>

                    <View style={styles.timePickerContainer}>
                      <Text style={styles.timeLabel}>To</Text>
                      <View style={styles.pickerWrapper}>
                        <Picker
                          selectedValue={operatingHours[day]?.closeTime || '17:00'}
                          onValueChange={(value) => handleTimeChange(day, 'closeTime', value)}
                          style={styles.picker}
                        >
                          {timeOptionsPM.map((time) => (
                            <Picker.Item
                              key={time.value}
                              label={time.label}
                              value={time.value}
                            />
                          ))}
                        </Picker>
                      </View>
                    </View>
                  </View>
                )}
              </View>
            ))}
          </ScrollView>

      {/* Footer Buttons - only when enabled */}
      {!disabled && (
        <View style={styles.footer}>
          <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
            <Text style={styles.saveButtonText}>Save Schedule</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  if (embedded) {
    return content;
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        {content}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    minHeight: '70%',
  },
  embeddedContainer: {
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    maxHeight: 500,
    overflow: 'hidden',
  },
  embeddedDisabled: {
    opacity: 0.6,
  },
  embeddedHeader: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerContent: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  closeButtonText: {
    fontSize: 18,
    color: '#6B7280',
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  embeddedContent: {
    paddingHorizontal: 20,
    maxHeight: 350,
    minHeight: 240,
  },
  dayRow: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  dayInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  dayName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingLeft: 8,
  },
  timePickerContainer: {
    flex: 1,
  },
  timeLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
    fontWeight: '500',
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    height: 44,
    justifyContent: 'center',
  },
  picker: {
    height: 44,
  },
  toText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 20,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  cancelButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: 'white',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  saveButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#8B5CF6',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
});

export default OperatingHoursModal;
