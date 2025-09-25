import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, ScrollView } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../navigation/types';
import { supabase } from '../../../services/supabase';

type Props = NativeStackScreenProps<RootStackParamList, 'ProductDetails'>;

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  image_url?: string;
}

const ProductDetailsScreen: React.FC<Props> = ({ route }) => {
  const { productId } = route.params;
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProduct = async () => {
      setLoading(true);
      setError(null);
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', productId)
        .single();
      if (error) {
        setError('Failed to load product details');
        setProduct(null);
      } else {
        setProduct(data || null);
      }
      setLoading(false);
    };
    fetchProduct();
  }, [productId]);

  if (loading) {
    return (
      <View style={styles.centered}><ActivityIndicator size="large" color="#4F46E5" /></View>
    );
  }
  if (error) {
    return (
      <View style={styles.centered}><Text style={{ color: 'red' }}>{error}</Text></View>
    );
  }
  if (!product) {
    return (
      <View style={styles.centered}><Text>Product not found.</Text></View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        {product.image_url ? (
          <View style={styles.imagePlaceholder}><Text>Image</Text></View>
          // Use <Image source={{ uri: product.image_url }} style={styles.image} /> for real images
        ) : (
          <View style={styles.imagePlaceholder}><Text>No Image</Text></View>
        )}
        <Text style={styles.name}>{product.name}</Text>
        <Text style={styles.price}>₱{product.price.toFixed(2)}</Text>
        <Text style={styles.desc}>{product.description}</Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8F8F8',
    padding: 24,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
  },
  imagePlaceholder: {
    width: 120,
    height: 120,
    backgroundColor: '#E5E7EB',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  name: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  price: {
    color: '#4F46E5',
    fontWeight: 'bold',
    fontSize: 18,
    marginBottom: 8,
  },
  desc: {
    color: '#555',
    fontSize: 15,
    textAlign: 'center',
  },
});

export default ProductDetailsScreen;
