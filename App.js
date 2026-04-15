import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Platform,
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';

const API_URL = 'https://wger.de/api/v2/exerciseinfo/?language=2&limit=100';
const ITEMS_PER_PAGE = 10;

function stripHtml(html) {
  return html ? html.replace(/<[^>]+>/g, '').trim() : 'No description available.';
}

function getTranslation(item, languageId = 2) {
  if (!item?.translations?.length) return null;
  return item.translations.find((translation) => translation.language === languageId)
    || item.translations[0];
}

function getExerciseName(item) {
  const translation = getTranslation(item, 2);
  return translation?.name || item.name || `Exercise ${item.id}`;
}

function getExerciseDescription(item) {
  const translation = getTranslation(item, 2);
  return stripHtml(translation?.description) || 'No description available.';
}

function normalizeExercise(item) {
  const displayName = getExerciseName(item);
  const displayDescription = getExerciseDescription(item);
  return {
    ...item,
    displayName,
    displayDescription,
    displayCategory: item.category?.name || 'General',
    displayImage:
      item.images?.find((img) => img.is_main === true)?.image ||
      item.images?.[0]?.image ||
      null,
  };
}

export default function App() {
  const [rawExercises, setRawExercises] = useState([]);
  const [filteredExercises, setFilteredExercises] = useState([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [openItemIds, setOpenItemIds] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadExercises() {
      try {
        const allExercises = [];
        let url = API_URL;

        while (url) {
          const response = await fetch(url);
          if (!response.ok) {
            throw new Error(`HTTP ${response.status} ${response.statusText}`);
          }

          const json = await response.json();
          if (!json.results) {
            throw new Error('Unexpected API response shape.');
          }

          allExercises.push(...json.results);
          url = json.next;
        }

        const sorted = allExercises
          .filter((item) => item && typeof getExerciseName(item) === 'string')
          .sort((a, b) =>
            getExerciseName(a).localeCompare(getExerciseName(b), undefined, { sensitivity: 'base' })
          );

        setRawExercises(sorted);
        setFilteredExercises(sorted.map(normalizeExercise));
      } catch (loadError) {
        console.error(loadError);
        setError(`Unable to load exercises: ${loadError.message}`);
      } finally {
        setLoading(false);
      }
    }

    loadExercises();
  }, []);

  useEffect(() => {
    const normalized = search.trim().toLowerCase();
    const itemsToSearch = rawExercises;

    const matched = normalized
      ? itemsToSearch.filter((item) => {
          const normalizedName = getExerciseName(item).toLowerCase();
          const normalizedDescription = getExerciseDescription(item).toLowerCase();
          return (
            normalizedName.includes(normalized) ||
            normalizedDescription.includes(normalized)
          );
        })
      : itemsToSearch;

    const normalizedResults = matched.map(normalizeExercise);
    setFilteredExercises(normalizedResults);
    setCurrentPage(0);
  }, [search, rawExercises]);

  const pageCount = Math.max(1, Math.ceil(filteredExercises.length / ITEMS_PER_PAGE));
  const exerciseCount = useMemo(() => filteredExercises.length, [filteredExercises]);
  const currentPageItems = filteredExercises.slice(
    currentPage * ITEMS_PER_PAGE,
    (currentPage + 1) * ITEMS_PER_PAGE
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ExpoStatusBar style="light" />
      <View style={styles.header}>
        <Text style={styles.brand}>Wger Exercise Browser</Text>
        <Text style={styles.subtitle}>Browse the public exercise catalog in React Native Web.</Text>
      </View>

      <View style={styles.searchSection}>
        <TextInput
          placeholder="Search exercises"
          placeholderTextColor="#8893b0"
          value={search}
          onChangeText={setSearch}
          style={styles.searchInput}
        />
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{exerciseCount} items</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#242B49" />
          <Text style={styles.loaderText}>Loading exercises...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <>
          <FlatList
            data={currentPageItems}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <Pressable
                onPress={() =>
                  setOpenItemIds((prev) =>
                    prev.includes(item.id)
                      ? prev.filter((id) => id !== item.id)
                      : [...prev, item.id]
                  )
                }
                style={({ pressed }) => [
                  styles.card,
                  pressed && styles.cardPressed,
                ]}
              >
                <Text style={styles.cardTitle}>{item.displayName}</Text>
                {item.displayImage ? (
                  <Text style={styles.imageIndicator}>📷 Image available</Text>
                ) : null}
                <Text style={styles.cardCategory}>{item.displayCategory}</Text>
                {openItemIds.includes(item.id) && item.displayImage ? (
                  <Image
                    source={{ uri: item.displayImage }}
                    style={styles.cardImage}
                    resizeMode="contain"
                  />
                ) : null}
                <Text style={styles.cardDescription} numberOfLines={4}>
                  {item.displayDescription}
                </Text>
              </Pressable>
            )}
            ListEmptyComponent={() => (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No exercises matched your search.</Text>
              </View>
            )}
          />

          <View style={styles.paginationRow}>
            <Pressable
              onPress={() => setCurrentPage((prev) => Math.max(prev - 1, 0))}
              disabled={currentPage === 0}
              style={({ pressed }) => [
                styles.pageButton,
                currentPage === 0 && styles.pageButtonDisabled,
                pressed && currentPage !== 0 && styles.pageButtonPressed,
              ]}
            >
              <Text style={styles.pageButtonText}>Previous</Text>
            </Pressable>

            <Text style={styles.pageIndicator}>
              Page {currentPage + 1} of {pageCount}
            </Text>

            <Pressable
              onPress={() => setCurrentPage((prev) => Math.min(prev + 1, pageCount - 1))}
              disabled={currentPage >= pageCount - 1}
              style={({ pressed }) => [
                styles.pageButton,
                currentPage >= pageCount - 1 && styles.pageButtonDisabled,
                pressed && currentPage < pageCount - 1 && styles.pageButtonPressed,
              ]}
            >
              <Text style={styles.pageButtonText}>Next</Text>
            </Pressable>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F6F8FF',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
    backgroundColor: '#242B49',
  },
  brand: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '700',
  },
  subtitle: {
    marginTop: 8,
    color: '#B0B9D6',
    fontSize: 15,
    lineHeight: 22,
  },
  searchSection: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
    backgroundColor: '#F6F8FF',
  },
  searchInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#111827',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  countBadge: {
    marginTop: 12,
    alignSelf: 'flex-start',
    backgroundColor: '#E5E9FF',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  countText: {
    color: '#242B49',
    fontSize: 13,
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    marginTop: 16,
    shadowColor: '#242B49',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  cardPressed: {
    transform: [{ scale: 0.995 }],
  },
  cardImage: {
    width: '100%',
    height: 220,
    borderRadius: 18,
    marginTop: 16,
    marginBottom: 16,
    backgroundColor: '#E5E9FF',
  },
  imageIndicator: {
    marginTop: 8,
    marginBottom: 6,
    color: '#2563EB',
    fontSize: 13,
    fontWeight: '600',
  },
  paginationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  pageButton: {
    backgroundColor: '#242B49',
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  pageButtonPressed: {
    backgroundColor: '#1b233d',
  },
  pageButtonDisabled: {
    backgroundColor: '#B0B9D6',
  },
  pageButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  pageIndicator: {
    color: '#242B49',
    fontSize: 15,
    fontWeight: '600',
  },
  cardTitle: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  cardCategory: {
    color: '#59627A',
    fontSize: 13,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardDescription: {
    color: '#4B5563',
    fontSize: 15,
    lineHeight: 22,
  },
  loaderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loaderText: {
    marginTop: 14,
    color: '#5C6B91',
    fontSize: 16,
  },
  errorContainer: {
    padding: 24,
    alignItems: 'center',
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 16,
    textAlign: 'center',
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 44,
  },
  emptyText: {
    color: '#6B7280',
    fontSize: 16,
  },
});
