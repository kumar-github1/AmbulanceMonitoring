import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  Modal,
  ActivityIndicator,
  Linking,
  Alert,
  Dimensions,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import HospitalService, { Hospital, Location, HospitalSearchOptions } from '../services/HospitalService';

interface Props {
  visible: boolean;
  userLocation: Location | null;
  onClose: () => void;
  onHospitalSelect: (hospital: Hospital) => void;
  onNearestHospital: (hospital: Hospital | null) => void;
  selectedHospitalId?: string;
}

const { height: screenHeight } = Dimensions.get('window');
const hospitalService = HospitalService.getInstance();

const HospitalSelectionBottomSheet: React.FC<Props> = ({
  visible,
  userLocation,
  onClose,
  onHospitalSelect,
  onNearestHospital,
  selectedHospitalId,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [filteredHospitals, setFilteredHospitals] = useState<Hospital[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'nearby' | 'recent' | 'favorites'>('nearby');
  const [sortBy, setSortBy] = useState<'distance' | 'time' | 'capacity' | 'rating'>('distance');
  const [emergencyOnly, setEmergencyOnly] = useState(false);

  useEffect(() => {
    if (visible && userLocation) {
      loadHospitals();
    }
  }, [visible, userLocation, sortBy, emergencyOnly, activeTab]);

  useEffect(() => {
    filterHospitals();
  }, [hospitals, searchQuery]);

  const loadHospitals = async () => {
    if (!userLocation) return;

    setLoading(true);
    try {
      let hospitalList: Hospital[] = [];

      switch (activeTab) {
        case 'nearby':
          const options: HospitalSearchOptions = {
            radius: 25,
            emergencyOnly,
            sortBy,
          };
          hospitalList = await hospitalService.getNearbyHospitals(userLocation, options);
          break;

        case 'recent':
          hospitalList = hospitalService.getRecentHospitals();
          // Add distance and time for recent hospitals
          hospitalList = hospitalList.map(hospital => ({
            ...hospital,
            distance: calculateDistance(userLocation, hospital.location),
            estimatedTime: calculateEstimatedTime(
              calculateDistance(userLocation, hospital.location)
            ),
          }));
          break;

        case 'favorites':
          hospitalList = await hospitalService.getFavoriteHospitals(userLocation);
          break;
      }

      setHospitals(hospitalList);
    } catch (error) {
      console.error('Error loading hospitals:', error);
      Alert.alert('Error', 'Failed to load hospitals. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const calculateDistance = (loc1: Location, loc2: Location): number => {
    const R = 6371;
    const dLat = (loc2.latitude - loc1.latitude) * Math.PI / 180;
    const dLon = (loc2.longitude - loc1.longitude) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(loc1.latitude * Math.PI / 180) * Math.cos(loc2.latitude * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const calculateEstimatedTime = (distance: number): number => {
    const baseSpeed = 40; // km/h
    return Math.round((distance / baseSpeed) * 60); // minutes
  };

  const filterHospitals = () => {
    if (!searchQuery.trim()) {
      setFilteredHospitals(hospitals);
      return;
    }

    const filtered = hospitals.filter(hospital =>
      hospital.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      hospital.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      hospital.facilities.some(facility =>
        facility.toLowerCase().includes(searchQuery.toLowerCase())
      ) ||
      hospital.address.toLowerCase().includes(searchQuery.toLowerCase())
    );

    setFilteredHospitals(filtered);
  };

  const handleNearestHospital = async () => {
    if (!userLocation) return;

    setLoading(true);
    try {
      const nearestHospital = await hospitalService.getNearestHospital(userLocation, true);
      onNearestHospital(nearestHospital);
      if (nearestHospital) {
        await hospitalService.addToRecentHospitals(nearestHospital);
        onClose();
      }
    } catch (error) {
      console.error('Error finding nearest hospital:', error);
      Alert.alert('Error', 'Failed to find nearest hospital.');
    } finally {
      setLoading(false);
    }
  };

  const handleHospitalSelect = async (hospital: Hospital) => {
    await hospitalService.addToRecentHospitals(hospital);
    onHospitalSelect(hospital);
    onClose();
  };

  const handleCall = (phoneNumber: string) => {
    const cleanNumber = phoneNumber.replace(/[^+\d]/g, '');
    if (cleanNumber) {
      Linking.openURL(`tel:${cleanNumber}`).catch(() => {
        Alert.alert('Error', 'Unable to make phone call');
      });
    } else {
      Alert.alert('Error', 'Phone number not available');
    }
  };

  const toggleFavorite = async (hospital: Hospital) => {
    try {
      const isFav = hospitalService.isFavorite(hospital.id);
      if (isFav) {
        await hospitalService.removeFromFavorites(hospital.id);
      } else {
        await hospitalService.addToFavorites(hospital.id);
      }
      // Reload hospitals to update favorite status
      await loadHospitals();
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  };

  const getCapacityColor = (hospital: Hospital): string => {
    const status = hospitalService.getCapacityStatus(hospital);
    switch (status) {
      case 'low': return '#4CAF50';
      case 'medium': return '#FF9800';
      case 'high': return '#F44336';
      default: return '#666';
    }
  };

  const getFacilityIcon = (facility: string): string => {
    const facilityLower = facility.toLowerCase();
    if (facilityLower.includes('emergency')) return '🚨';
    if (facilityLower.includes('icu') || facilityLower.includes('intensive')) return '🏥';
    if (facilityLower.includes('surgery')) return '⚕️';
    if (facilityLower.includes('cardio')) return '❤️';
    if (facilityLower.includes('trauma')) return '🩹';
    if (facilityLower.includes('pediatric') || facilityLower.includes('children')) return '👶';
    if (facilityLower.includes('maternity') || facilityLower.includes('birth')) return '🤱';
    if (facilityLower.includes('burn')) return '🔥';
    return '🏥';
  };

  const renderHospitalCard = ({ item: hospital }: { item: Hospital }) => {
    const isSelected = hospital.id === selectedHospitalId;
    const isFavorite = hospitalService.isFavorite(hospital.id);
    const capacityStatus = hospitalService.getCapacityStatus(hospital);

    return (
      <TouchableOpacity
        style={[styles.hospitalCard, isSelected && styles.selectedCard]}
        onPress={() => handleHospitalSelect(hospital)}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <View style={styles.hospitalInfo}>
            <Text style={styles.hospitalName} numberOfLines={1}>
              {hospital.name}
            </Text>
            <View style={styles.hospitalMeta}>
              <Text style={styles.hospitalType}>{hospital.type}</Text>
              {hospital.emergencyServices && (
                <View style={styles.emergencyBadge}>
                  <Text style={styles.emergencyText}>ER</Text>
                </View>
              )}
              {!hospital.isOpen24Hours && (
                <View style={styles.hoursWarning}>
                  <Text style={styles.warningText}>Limited Hours</Text>
                </View>
              )}
            </View>
          </View>
          
          <TouchableOpacity
            style={styles.favoriteButton}
            onPress={() => toggleFavorite(hospital)}
          >
            <Ionicons
              name={isFavorite ? 'heart' : 'heart-outline'}
              size={24}
              color={isFavorite ? '#F44336' : '#666'}
            />
          </TouchableOpacity>
        </View>

        <View style={styles.cardBody}>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Ionicons name="location-outline" size={16} color="#666" />
              <Text style={styles.statText}>
                {hospital.distance ? hospitalService.formatDistance(hospital.distance) : 'N/A'}
              </Text>
            </View>
            
            <View style={styles.statItem}>
              <Ionicons name="time-outline" size={16} color="#666" />
              <Text style={styles.statText}>
                {hospital.estimatedTime ? hospitalService.formatTime(hospital.estimatedTime) : 'N/A'}
              </Text>
            </View>
            
            <View style={styles.statItem}>
              <View style={[styles.capacityDot, { backgroundColor: getCapacityColor(hospital) }]} />
              <Text style={styles.statText}>
                {hospital.currentLoad ? `${hospital.currentLoad}/${hospital.capacity}` : 'Unknown'}
              </Text>
            </View>

            {hospital.rating && (
              <View style={styles.statItem}>
                <Ionicons name="star" size={16} color="#FFD700" />
                <Text style={styles.statText}>{hospital.rating.toFixed(1)}</Text>
              </View>
            )}
          </View>

          <View style={styles.facilitiesRow}>
            {hospital.facilities.slice(0, 4).map((facility, index) => (
              <View key={index} style={styles.facilityTag}>
                <Text style={styles.facilityIcon}>{getFacilityIcon(facility)}</Text>
                <Text style={styles.facilityText} numberOfLines={1}>
                  {facility}
                </Text>
              </View>
            ))}
            {hospital.facilities.length > 4 && (
              <View style={styles.facilityTag}>
                <Text style={styles.facilityText}>+{hospital.facilities.length - 4} more</Text>
              </View>
            )}
          </View>

          <Text style={styles.hospitalAddress} numberOfLines={2}>
            {hospital.address}
          </Text>
        </View>

        <View style={styles.cardActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleCall(hospital.phoneNumber)}
          >
            <Ionicons name="call-outline" size={20} color="#4CAF50" />
            <Text style={styles.actionText}>Call</Text>
          </TouchableOpacity>
          
          <View style={styles.selectButtonContainer}>
            <TouchableOpacity
              style={[styles.selectButton, isSelected && styles.selectedButton]}
              onPress={() => handleHospitalSelect(hospital)}
            >
              <Text style={[styles.selectText, isSelected && styles.selectedText]}>
                {isSelected ? 'Selected' : 'Select'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="location-outline" size={64} color="#ccc" />
      <Text style={styles.emptyTitle}>
        {searchQuery ? 'No hospitals found' : 'No hospitals available'}
      </Text>
      <Text style={styles.emptySubtitle}>
        {searchQuery 
          ? 'Try adjusting your search terms'
          : 'Unable to load hospital data at this time'
        }
      </Text>
    </View>
  );

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <StatusBar backgroundColor="rgba(0,0,0,0.5)" barStyle="light-content" />
        
        <View style={styles.bottomSheet}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Select Hospital</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          {/* Quick Action */}
          <TouchableOpacity
            style={styles.quickButton}
            onPress={handleNearestHospital}
            disabled={loading}
          >
            <Ionicons name="navigate-circle-outline" size={24} color="#fff" />
            <Text style={styles.quickButtonText}>Nearest Emergency Hospital</Text>
            {loading && <ActivityIndicator size="small" color="#fff" />}
          </TouchableOpacity>

          {/* Search */}
          <View style={styles.searchContainer}>
            <Ionicons name="search-outline" size={20} color="#666" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search hospitals, specialties, facilities..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor="#999"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={20} color="#666" />
              </TouchableOpacity>
            )}
          </View>

          {/* Tabs */}
          <View style={styles.tabContainer}>
            {[
              { key: 'nearby', label: 'Nearby', icon: 'location-outline' },
              { key: 'recent', label: 'Recent', icon: 'time-outline' },
              { key: 'favorites', label: 'Favorites', icon: 'heart-outline' },
            ].map(tab => (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tab, activeTab === tab.key && styles.activeTab]}
                onPress={() => setActiveTab(tab.key as any)}
              >
                <Ionicons
                  name={tab.icon as any}
                  size={20}
                  color={activeTab === tab.key ? '#2196F3' : '#666'}
                />
                <Text
                  style={[styles.tabText, activeTab === tab.key && styles.activeTabText]}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Filters */}
          {activeTab === 'nearby' && (
            <View style={styles.filtersContainer}>
              <TouchableOpacity
                style={[styles.filterChip, emergencyOnly && styles.activeFilter]}
                onPress={() => setEmergencyOnly(!emergencyOnly)}
              >
                <Text
                  style={[styles.filterText, emergencyOnly && styles.activeFilterText]}
                >
                  Emergency Only
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.sortButton}
                onPress={() => {
                  const sortOptions = ['distance', 'time', 'capacity', 'rating'];
                  const currentIndex = sortOptions.indexOf(sortBy);
                  const nextIndex = (currentIndex + 1) % sortOptions.length;
                  setSortBy(sortOptions[nextIndex] as any);
                }}
              >
                <Ionicons name="swap-vertical-outline" size={16} color="#666" />
                <Text style={styles.sortText}>
                  Sort by {sortBy.charAt(0).toUpperCase() + sortBy.slice(1)}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Hospital List */}
          <FlatList
            data={filteredHospitals}
            renderItem={renderHospitalCard}
            keyExtractor={item => item.id}
            style={styles.list}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={!loading ? renderEmptyState : null}
            refreshing={loading}
            onRefresh={loadHospitals}
          />

          {loading && filteredHospitals.length === 0 && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#2196F3" />
              <Text style={styles.loadingText}>Loading hospitals...</Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  bottomSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: screenHeight * 0.8,
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 4,
  },
  quickButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F44336',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  quickButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    marginHorizontal: 16,
    marginBottom: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 6,
    gap: 4,
  },
  activeTab: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#2196F3',
    fontWeight: '600',
  },
  filtersContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 12,
  },
  filterChip: {
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  activeFilter: {
    backgroundColor: '#2196F3',
  },
  filterText: {
    fontSize: 14,
    color: '#666',
  },
  activeFilterText: {
    color: '#fff',
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sortText: {
    fontSize: 14,
    color: '#666',
  },
  list: {
    maxHeight: screenHeight * 0.5,
  },
  hospitalCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#eee',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  selectedCard: {
    borderColor: '#2196F3',
    borderWidth: 2,
    backgroundColor: '#f8f9ff',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  hospitalInfo: {
    flex: 1,
  },
  hospitalName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  hospitalMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  hospitalType: {
    fontSize: 14,
    color: '#666',
  },
  emergencyBadge: {
    backgroundColor: '#F44336',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  emergencyText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  hoursWarning: {
    backgroundColor: '#FF9800',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  warningText: {
    color: '#fff',
    fontSize: 12,
  },
  favoriteButton: {
    padding: 4,
  },
  cardBody: {
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 16,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 14,
    color: '#666',
  },
  capacityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  facilitiesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
    gap: 6,
  },
  facilityTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  facilityIcon: {
    fontSize: 12,
  },
  facilityText: {
    fontSize: 12,
    color: '#666',
    maxWidth: 80,
  },
  hospitalAddress: {
    fontSize: 12,
    color: '#999',
    lineHeight: 16,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 8,
  },
  actionText: {
    color: '#4CAF50',
    fontSize: 14,
    fontWeight: '500',
  },
  selectButtonContainer: {
    flex: 1,
    alignItems: 'flex-end',
  },
  selectButton: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 24,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 80,
    alignItems: 'center',
  },
  selectedButton: {
    backgroundColor: '#4CAF50',
  },
  selectText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  selectedText: {
    color: '#fff',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
});

export default HospitalSelectionBottomSheet;