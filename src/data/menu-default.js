/**
 * THE PRINTED CARD — the menu exactly as it is printed (November 2025).
 *
 * This is the copy the admin's "reset to the printed card" restores to, so it
 * must stay a faithful transcription and nothing else. Day-to-day edits happen
 * in the database; this file only changes when the café prints a new card.
 *
 * Kept in step with `web/src/data/menu.js`, which seeds a fresh database.
 * Prices are in INR. `star: true` marks a BINILEAF Special (must-try) — the
 * same items carry the cat glyph on the printed card.
 *
 * Shape: menu -> section (a page column) -> group (a heading) -> items.
 * This file is the seed for the `menu_sections` / `menu_groups` / `menu_items`
 * tables; once Neon is populated the site reads from there instead.
 */

export const menu = [
  {
    id: 'hot',
    title: 'Hot Beverages',
    kicker: 'Poured all day',
    blurb:
      'The coffee half and the tea half of the name, side by side. Espresso pulled fresh, and a masala chai that tastes like the one at home.',
    image: '/media/drinks/cafe-latte.webp',
    groups: [
      {
        id: 'hot-coffee',
        title: 'Hot Coffee',
        items: [
          { name: 'Espresso', price: 120 },
          { name: 'Cappuccino', price: 160 },
          { name: 'Cafe Latte', price: 170 },
          { name: 'Irish Latte', price: 180 },
          { name: 'Caramel Latte', price: 180 },
          { name: 'Cafe Mocha', price: 190 },
          { name: 'Hazelnut Cappuccino', price: 190, star: true },
          { name: 'French Vanilla Cappuccino', price: 190 },
          { name: 'Nutella Mocha', price: 210, star: true },
          { name: 'Americano', price: 160 },
          { name: 'Matcha Latte', price: 280 },
        ],
      },
      {
        id: 'tea',
        title: 'Tea',
        items: [
          { name: 'Regular Indian Masala Tea', price: 60 },
          { name: 'Adrak Mint Tea', price: 70 },
          { name: 'Honey Lemon Tea', price: 80, star: true },
          { name: 'Black Tea', price: 80 },
        ],
      },
      {
        id: 'hot-chocolate',
        title: 'Hot Chocolate',
        items: [
          { name: 'Classic Hot Chocolate', price: 190 },
          { name: 'Hazelnut Hot Chocolate', price: 220 },
          { name: 'Brownie Hot Chocolate', price: 230, star: true },
        ],
      },
      {
        id: 'lemonade',
        title: 'Lemonade',
        note: 'Shaken to order, heavy on the ice. The masala one is not a gimmick.',
        items: [
          { name: 'Indian Masala Lemonade', price: 120 },
          { name: 'Orange Mint Lemonade', price: 150 },
          { name: 'Mango Coconut Lemonade', price: 150 },
        ],
      },
    ],
  },
  {
    id: 'cold',
    title: 'Cold Beverages',
    kicker: 'Ahmedabad weather, handled',
    blurb:
      'Frappes, iced coffee, ice teas, thick shakes and mocktails. Tall glasses, a lot of ice, no shortcuts.',
    image: '/media/drinks/iced-coffee-layered.webp',
    groups: [
      {
        id: 'cold-coffee',
        title: 'Cold Coffee',
        items: [
          { name: 'Regular Cold Coffee', price: 160 },
          { name: 'Mocha Frappe', price: 180 },
          { name: 'Roasted Hazelnut Frappe', price: 210, star: true },
          { name: 'Irish Cream Frappe', price: 200 },
          { name: 'Tiramisu Frappe', price: 220, star: true },
          { name: 'Caramel Frappe', price: 200 },
          { name: 'Nutella Hazelnut Frappe', price: 250, star: true },
          { name: 'Vanilla Frappe', price: 180 },
          { name: 'Devil Frappe', price: 210 },
        ],
      },
      {
        id: 'iced-coffee',
        title: 'Iced Cold Coffee',
        items: [
          { name: 'Iced Cappuccino', price: 160 },
          { name: 'Vietnamese Iced Coffee', price: 230, star: true },
          { name: 'Long Black Iced Coffee', price: 180 },
          { name: 'Iced Mocha', price: 170 },
        ],
      },
      {
        id: 'ice-tea',
        title: 'Ice Tea',
        items: [
          { name: 'Lemon Ice Tea', price: 170 },
          { name: 'Watermelon Ice Tea', price: 190 },
          { name: 'Tropical Ice Tea', price: 210, star: true },
          { name: 'Green Apple Ice Tea', price: 190 },
        ],
      },
      {
        id: 'thick-shakes',
        title: 'Thick Shakes',
        items: [
          { name: 'Choco Chips Shake', price: 180 },
          { name: 'Kitkat Shake', price: 220 },
          { name: 'Biscoff Shake', price: 250 },
          { name: 'Cookie & Cream Shake', price: 210, star: true },
          { name: 'Choco Berry Shake', price: 210 },
          { name: 'Brownie Nutella Shake', price: 290, star: true },
          { name: 'Mud Pie Shake', price: 230 },
          { name: 'Vanilla Shake', price: 190 },
        ],
      },
      {
        id: 'mocktails',
        title: 'Mocktails',
        items: [
          { name: 'Mint Mojito', price: 150 },
          { name: 'Bull Melon', price: 290, star: true },
          { name: 'Lavender Mojito', price: 180 },
          { name: 'Green Apple Coolers', price: 160 },
          { name: 'Strawberry Coolers', price: 160 },
        ],
      },
    ],
  },
  {
    id: 'barista',
    title: 'Barista Special',
    kicker: 'Only here',
    blurb:
      'The drinks our baristas built from scratch. If you order one thing off this card, order from this list.',
    image: '/media/drinks/tote-mocktail.webp',
    groups: [
      {
        id: 'barista-special',
        title: 'Barista Special',
        items: [
          { name: 'Golden Drift', price: 290, star: true },
          { name: 'Coconut Matcha', price: 350 },
          { name: 'Watermelon Tonic Matcha', price: 360, star: true },
          { name: 'Tonic Espresso', price: 290 },
          { name: 'Barrelage Brew', price: 310 },
          { name: 'Tote Mocktail', price: 450, star: true, note: 'Serves a table. Comes in the bag.' },
        ],
      },
      {
        id: 'add-ons',
        title: 'Special Add-on',
        note: 'Add either of these to anything already on your table.',
        items: [
          { name: 'Regular Espresso Shot', price: 60 },
          { name: 'Ice Cream Scoop', price: 50 },
        ],
      },
    ],
  },
  {
    id: 'food',
    title: 'Food',
    kicker: 'Kitchen open till close',
    blurb:
      'Pizzas, loaded sandwiches, pasta and the fries people keep coming back for. All of it vegetarian.',
    image: '/media/food/sandwich-platter.webp',
    groups: [
      {
        id: 'pizza',
        title: 'Pizza',
        items: [
          { name: 'Margherita Pizza', price: 250 },
          { name: 'Farm Fresh Pizza', price: 270, star: true },
          { name: 'Italian Pizza', price: 280 },
          { name: 'Tandoori Paneer Pizza', price: 270 },
        ],
      },
      {
        id: 'sandwich',
        title: 'Sandwich',
        items: [
          { name: 'Chilly Cheese', price: 280 },
          { name: 'Sandwich Croissant', price: 320, star: true },
          { name: 'Cottage Cheese Focaccia', price: 360 },
          { name: 'Avocado Sandwich', price: 410, star: true },
          { name: 'Peri Peri Paneer Sandwich', price: 290 },
        ],
      },
      {
        id: 'crispy-bites',
        title: 'Crispy Bites',
        items: [
          { name: 'Salted French Fries', price: 170 },
          { name: 'Peri Peri French Fries', price: 190 },
          { name: 'Butter Garlic French Fries', price: 250, star: true },
          { name: 'Veg. Loaded Nachoes', price: 250 },
          { name: 'Garlic Bread', price: 190 },
          { name: 'Cheese Balls', price: 180 },
        ],
      },
      {
        id: 'pasta',
        title: 'Pasta',
        items: [
          { name: 'Mama Rosa Pasta', price: 230, star: true },
          { name: 'Arrabiata Pasta', price: 190 },
          { name: 'Alfredo Pasta', price: 200 },
          { name: 'Cheesy Pasta', price: 310, star: true },
        ],
      },
      {
        id: 'dessert',
        title: 'Dessert',
        items: [
          { name: 'Hot Choco Brownie', price: 210 },
          { name: 'Brownie Sundae', price: 250 },
          { name: 'Brownie With Choco Ice Cream', price: 260 },
        ],
      },
    ],
  },
];

/** Flat list — handy for search, counts and JSON-LD. */
export const allMenuItems = menu.flatMap((section) =>
  section.groups.flatMap((group) =>
    group.items.map((item) => ({
      ...item,
      sectionId: section.id,
      section: section.title,
      groupId: group.id,
      group: group.title,
    }))
  )
);

export const menuStats = {
  items: allMenuItems.length,
  sections: menu.length,
  groups: menu.reduce((n, s) => n + s.groups.length, 0),
  cheapest: Math.min(...allMenuItems.map((i) => i.price)),
  dearest: Math.max(...allMenuItems.map((i) => i.price)),
};

/** Look one item up by name — used by the home page's curated rows. */
export const itemByName = (name) => allMenuItems.find((item) => item.name === name);
