#!/usr/bin/env python3
import torch
import torch.serialization

print("Fixing YOLO model for PyTorch 2.6+")
print("=" * 50)

try:
    from ultralytics.nn.tasks import DetectionModel
    torch.serialization.add_safe_globals([DetectionModel])
    print("✅ Added DetectionModel to safe globals")
except Exception as e:
    print(f"❌ Error: {e}")
    exit(1)

try:
    checkpoint = torch.load("best.pt", map_location="cpu")
    print("✅ Model loaded successfully")
    print(f"   Model type: {type(checkpoint)}")

    if isinstance(checkpoint, dict) and 'model' in checkpoint:
        print(f"   Contains model: {type(checkpoint['model'])}")

    torch.save(checkpoint, "best_fixed.pt")
    print("✅ Saved fixed model as 'best_fixed.pt'")
    print("\nUpdate your code to use 'best_fixed.pt' instead of 'best.pt'")

except Exception as e:
    print(f"❌ Failed to fix model: {e}")
    print("\nTry this alternative approach:")
    print("1. Export model in a compatible format:")
    print("   model.export(format='torchscript')")
    print("2. Or use the original training framework to re-export")
