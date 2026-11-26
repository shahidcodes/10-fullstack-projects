import 'package:flutter/material.dart';
import 'package:voting_app/app/app.dart';
import 'package:voting_app/core/di/injection_container.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initDependencies();
  runApp(const VoteSphereApp());
}
