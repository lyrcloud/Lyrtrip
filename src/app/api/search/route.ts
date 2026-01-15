import { NextRequest, NextResponse } from 'next/server';

// Mock data for different services
const mockData = {
  hotels: [
    { id: '1', name: 'Luxury Palace Hotel', description: '5-star hotel with ocean view', rating: 4.8, price: 250 },
    { id: '2', name: 'Downtown Inn', description: 'Modern boutique hotel in city center', rating: 4.5, price: 120 },
    { id: '3', name: 'Budget Stay', description: 'Affordable accommodation with good service', rating: 4.2, price: 65 },
  ],
  flights: [
    { id: '1', name: 'Emirates Flight EK123', description: 'Direct flight, Business class available', rating: 4.7, price: 450 },
    { id: '2', name: 'Swiss International Flight', description: '1 stop, Economy and Business', rating: 4.6, price: 380 },
    { id: '3', name: 'Budget Airline Flight', description: 'Low cost carrier, Direct', rating: 4.1, price: 180 },
  ],
  car: [
    { id: '1', name: 'Premium Car Rental - Tesla Model 3', description: 'Electric vehicle, luxury experience', rating: 4.9, price: 120 },
    { id: '2', name: 'Standard Sedan - Toyota Camry', description: 'Reliable and comfortable', rating: 4.5, price: 55 },
    { id: '3', name: 'Economy Car - Hyundai i20', description: 'Budget-friendly option', rating: 4.3, price: 35 },
  ],
  bus: [
    { id: '1', name: 'Premium Bus - VIP Coach', description: 'Luxury seats, AC, WiFi, Meals included', rating: 4.7, price: 95 },
    { id: '2', name: 'Express Bus Service', description: 'Direct route, Comfortable seats', rating: 4.4, price: 55 },
    { id: '3', name: 'Economy Bus', description: 'Standard seating, Basic amenities', rating: 4.1, price: 25 },
  ],
  train: [
    { id: '1', name: 'High Speed Train - First Class', description: 'Ultra-fast, Private cabin, Meals', rating: 4.8, price: 180 },
    { id: '2', name: 'Express Train - Business Class', description: 'Fast service, Comfortable seating', rating: 4.6, price: 95 },
    { id: '3', name: 'Standard Train', description: 'Economy travel with good amenities', rating: 4.2, price: 45 },
  ],
  cruise: [
    { id: '1', name: 'Caribbean Paradise Cruise', description: '7 days, All-inclusive, Entertainment', rating: 4.9, price: 1200 },
    { id: '2', name: 'Mediterranean Cruise', description: '10 days, Multiple ports, Luxury cabins', rating: 4.7, price: 2000 },
    { id: '3', name: 'Budget Cruise Adventure', description: '4 days, Beautiful destinations, Fun activities', rating: 4.3, price: 450 },
  ],
  dash: [
    { id: '1', name: 'Italian Pizzeria - Mama Mia', description: 'Authentic Italian pizza and pasta, 30-45 min delivery', rating: 4.8, price: 35 },
    { id: '2', name: 'Asian Fusion - Dragon Palace', description: 'Chinese, Thai, Vietnamese fusion cuisine', rating: 4.6, price: 28 },
    { id: '3', name: 'Burger & Fries Heaven', description: 'Gourmet burgers, hand-cut fries, shakes', rating: 4.5, price: 22 },
  ],
  tourism: [
    { id: '1', name: 'Eiffel Tower Tour', description: 'Guided tour with skip-the-line tickets, 3 hours', rating: 4.9, price: 95 },
    { id: '2', name: 'Local City Walking Tour', description: 'Explore hidden gems with local guide, 2.5 hours', rating: 4.6, price: 45 },
    { id: '3', name: 'Museum Pass - 24 Hours', description: 'Access to 5 major museums with guide', rating: 4.7, price: 85 },
  ],
  study: [
    { id: '1', name: 'Oxford University - Masters Program', description: 'Prestigious postgraduate degree, 1 year', rating: 4.9, price: 35000 },
    { id: '2', name: 'University of Toronto - Bachelor Program', description: 'International student program, 4 years', rating: 4.7, price: 25000 },
    { id: '3', name: 'Online Course Platform - Certificate', description: 'Professional certification, Self-paced, 3 months', rating: 4.5, price: 599 },
  ],
  career: [
    { id: '1', name: 'Senior Software Engineer - Google', description: 'Remote position, Competitive salary, Benefits', rating: 4.8, price: 200000 },
    { id: '2', name: 'Product Manager - Startup', description: 'Growth-focused role, Equity options, NYC', rating: 4.6, price: 150000 },
    { id: '3', name: 'Junior Developer - Tech Company', description: 'Entry-level, Mentorship, Remote-friendly', rating: 4.4, price: 80000 },
  ],
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { service } = body;

    // Validate service type
    if (!service || !(service in mockData)) {
      return NextResponse.json(
        { error: 'Invalid service type' },
        { status: 400 }
      );
    }

    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));

    // Return mock results for the requested service
    const results = mockData[service as keyof typeof mockData];

    return NextResponse.json({
      success: true,
      service,
      results: results || [],
      total: results?.length || 0,
    });
  } catch (error) {
    console.error('Search API error:', error);
    return NextResponse.json(
      { error: 'Failed to process search request' },
      { status: 500 }
    );
  }
}
