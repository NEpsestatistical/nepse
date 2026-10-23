  if (t.side.startsWith("b")) {
      const buyFees = (t.fees !== undefined && t.fees !== null && !Number.isNaN(Number(t.fees))) ? Number(t.fees) : 0;
      const unitCost = t.qty > 0 ? t.price + (buyFees / t.qty) : t.price;
      const lot = { qty: t.qty, price: unitCost, date: t.date, transactionId: t.id, originalQty: t.qty };
      lots.push(lot);
      lotRegistry[t.id] = lot;
      perTransaction[t.id] = {
        transactionId: t.id,
        symbol: t.symbol,
        side: "buy",
        qty: t.qty,
        price: t.price,
        date: t.date,
        fees: buyFees || null,
        costBasis: t.qty * t.price + buyFees,
        proceeds: null,
        realizedPL: null,
        realizedPLPercent: null,
        matches: [],
      };
