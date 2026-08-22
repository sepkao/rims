import { useState } from "react";

// --- Icons ---
const FilterIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
  </svg>
);

const PlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"></line>
    <line x1="5" y1="12" x2="19" y2="12"></line>
  </svg>
);

const StarIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="#F59E0B" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
  </svg>
);

// --- Mock Data ---
const categories = ["All Items", "Appetizers", "Mains", "Sides", "Desserts", "Beverages"];

const menuItems = [
  {
    id: 1,
    name: "Wagyu Steak Frites",
    description: "8oz A5 Wagyu, truffle-infused fries, peppercorn reduction, and microgreens.",
    price: "$42.00",
    badge: "Premium",
    sku: "WAG-SF-8",
    rating: 4.9,
    image: "https://images.unsplash.com/photo-1600891964092-4316c288032e?q=80&w=800&auto=format&fit=crop"
  },
  {
    id: 2,
    name: "Heirloom Carrot Salad",
    description: "Roasted honey-glazed carrots, herb-whipped goat cheese, and toasted pistachios.",
    price: "$18.00",
    badge: "Vegan Opt",
    sku: "SAL-HC-0",
    rating: 4.7,
    image: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?q=80&w=800&auto=format&fit=crop"
  },
  {
    id: 3,
    name: "Seared Atlantic Scallops",
    description: "U10 Scallops, minted pea purée, pancetta crisp, and citrus foam.",
    price: "$34.00",
    badge: null,
    sku: "SEA-SCA-2",
    rating: 4.8,
    image: "https://images.unsplash.com/photo-1626779849586-9a25b1bc8b98?q=80&w=800&auto=format&fit=crop"
  },
  {
    id: 4,
    name: "Sourdough & Butter",
    description: "House-made 48hr fermented sourdough, cultured butter, and smoked salt.",
    price: "$12.00",
    badge: null,
    sku: "APP-SDB-1",
    rating: 5.0,
    image: "https://images.unsplash.com/photo-1589367920969-ab8e050bf0ef?q=80&w=800&auto=format&fit=crop"
  }
];

export default function MenuManagementPage() {
  const [activeCategory, setActiveCategory] = useState("All Items");

  return (
    <div className="admin-page max-w-[1200px] w-full">
      
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#4A322F] mb-1">Menu Preset</h1>
          <p className="text-sm text-[#777]">Curated selections for table service.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <button className="admin-control flex items-center gap-2 px-4 py-2 bg-white border border-[#e0dcd5] rounded-md text-sm font-semibold text-[#555] hover:bg-gray-50 shadow-sm transition-colors">
            <FilterIcon /> Filter
          </button>
          <button className="admin-primary flex items-center gap-2 px-4 py-2 bg-[#5a403e] rounded-md text-sm font-semibold text-white hover:bg-[#4a322f] shadow-sm transition-colors">
            <PlusIcon /> Add New Dish
          </button>
        </div>
      </div>

      {/* Categories Tabs */}
      <div className="flex gap-3 mb-8 overflow-x-auto pb-2 scrollbar-hide">
        {categories.map((category) => (
          <button
            key={category}
            onClick={() => setActiveCategory(category)}
            className={`
              whitespace-nowrap px-5 py-2 rounded-full text-sm font-semibold transition-all
              ${activeCategory === category
                ? "admin-primary bg-[#5a403e] text-white shadow-md"
                : "admin-control bg-white text-[#666] border border-[#e0dcd5] hover:border-[#b8b2a8] hover:bg-gray-50"
              }
            `}
          >
            {category}
          </button>
        ))}
      </div>

      {/* Menu Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {menuItems.map((item) => (
          <div 
            key={item.id} 
            className="admin-menu-card bg-white rounded-xl border border-[#eae6e1] overflow-hidden flex flex-col shadow-sm hover:shadow-md transition-all group"
          >
            {/* Card Image */}
            <div className="relative h-48 w-full overflow-hidden bg-gray-100">
              <img 
                src={item.image} 
                alt={item.name} 
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute top-3 right-3 bg-black/70 backdrop-blur-sm text-white text-xs font-bold px-2.5 py-1 rounded-md">
                {item.price}
              </div>
            </div>

            {/* Card Content */}
            <div className="p-5 flex flex-col flex-1">
              <div className="flex justify-between items-start mb-2 gap-2">
                <h3 className="font-bold text-[#222] text-lg leading-tight">{item.name}</h3>
                {item.badge && (
                  <span className="bg-[#bda69e]/30 text-[#5a403e] text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider whitespace-nowrap">
                    {item.badge}
                  </span>
                )}
              </div>
              
              <p className="text-xs text-[#777] line-clamp-2 mb-4 leading-relaxed">
                {item.description}
              </p>

              {/* Card Footer */}
              <div className="mt-auto flex justify-between items-center text-xs font-mono font-medium text-[#888] pt-4 border-t border-[#f5f5f5]">
                <span>SKU: {item.sku}</span>
                <span className="flex items-center gap-1 font-sans font-bold text-[#444]">
                  <StarIcon /> {item.rating.toFixed(1)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}
